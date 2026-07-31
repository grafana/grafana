import {
  type DataFrame,
  type FieldConfig,
  type FieldConfigOptionsRegistry,
  FieldConfigProperty,
  type FieldConfigSource,
  type ItemKindContext,
  type ItemKindDescriptor,
  type PanelItem,
  applyItemOverrides,
  createItemConfigRegistry,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { getEdgeFields, getGraphFrame, getNodeFields, getNodeGraphDataFrames } from './utils';

/** Custom item-config properties offered for nodes. */
export interface NodeItemConfig {
  nodeRadius?: number;
}

/** Custom item-config properties offered for edges. */
export interface EdgeItemConfig {
  thickness?: number;
  strokeDasharray?: string;
}

export const NODE_ITEM_KIND = 'node';
export const EDGE_ITEM_KIND = 'edge';

/** Resolved per-mark styles, keyed by node/edge id. Absent id means "no override". */
export type ResolvedNodeStyles = Map<string, FieldConfig<NodeItemConfig>>;
export type ResolvedEdgeStyles = Map<string, FieldConfig<EdgeItemConfig>>;

export function getNodeItems(data: DataFrame[], _context?: ItemKindContext): PanelItem[] {
  const { nodes } = getGraphFrame(getNodeGraphDataFrames(data));
  const frame = nodes[0];
  if (!frame) {
    return [];
  }

  const fields = getNodeFields(frame);
  if (!fields.id) {
    return [];
  }

  return fields.id.values.map((id: string, index: number) => ({
    id,
    label: fields.title?.values[index] || id,
    description: fields.subTitle?.values[index] || undefined,
  }));
}

export function getEdgeItems(data: DataFrame[], _context?: ItemKindContext): PanelItem[] {
  const { edges } = getGraphFrame(getNodeGraphDataFrames(data));
  const frame = edges[0];
  if (!frame) {
    return [];
  }

  const fields = getEdgeFields(frame);
  if (!fields.id) {
    return [];
  }

  return fields.id.values.map((id: string, index: number) => ({
    id: String(id),
    // Edge ids are usually opaque, so label by the pair the user actually recognises
    label:
      fields.source && fields.target ? `${fields.source.values[index]} → ${fields.target.values[index]}` : String(id),
  }));
}

export function getNodeItemKind(): ItemKindDescriptor<NodeItemConfig> {
  return {
    id: NODE_ITEM_KIND,
    name: t('node-graph.item-kind-nodes', 'Nodes'),
    getItems: getNodeItems,
    standardOptions: {
      [FieldConfigProperty.Color]: {},
      [FieldConfigProperty.Links]: {},
    },
    useCustomConfig: (builder) => {
      builder.addNumberInput({
        path: 'nodeRadius',
        name: t('node-graph.item-config.name-node-radius', 'Node radius'),
        description: t('node-graph.item-config.description-node-radius', 'Radius of the node circle in pixels'),
        settings: { min: 1, max: 200 },
      });
    },
  };
}

export function getEdgeItemKind(): ItemKindDescriptor<EdgeItemConfig> {
  return {
    id: EDGE_ITEM_KIND,
    name: t('node-graph.item-kind-edges', 'Edges'),
    getItems: getEdgeItems,
    standardOptions: {
      [FieldConfigProperty.Color]: {},
      [FieldConfigProperty.Links]: {},
    },
    useCustomConfig: (builder) => {
      builder.addNumberInput({
        path: 'thickness',
        name: t('node-graph.item-config.name-thickness', 'Thickness'),
        description: t('node-graph.item-config.description-thickness', 'Stroke width of the edge line'),
        settings: { min: 0.5, max: 20 },
      });
      builder.addTextInput({
        path: 'strokeDasharray',
        name: t('node-graph.item-config.name-stroke-dasharray', 'Dash array'),
        description: t('node-graph.item-config.description-stroke-dasharray', 'SVG stroke-dasharray, e.g. "5 5"'),
      });
    },
  };
}

// The editor builds its registries from the plugin; the panel is rendered without a plugin
// reference, so it builds its own. Both go through createItemConfigRegistry, so they agree.
// Built lazily because standardFieldConfigEditorRegistry is only populated at app startup.
let registries: { node: FieldConfigOptionsRegistry; edge: FieldConfigOptionsRegistry } | undefined;

function getRegistries() {
  registries ??= {
    node: createItemConfigRegistry(getNodeItemKind(), 'nodeGraph'),
    edge: createItemConfigRegistry(getEdgeItemKind(), 'nodeGraph'),
  };
  return registries;
}

/**
 * Resolves the node and edge item overrides stored on the panel against the current data.
 *
 * Returns empty maps when the panel has no rules, so callers can call this unconditionally.
 */
export function resolveItemStyles(
  fieldConfig: FieldConfigSource,
  data: DataFrame[],
  context: ItemKindContext
): { nodeStyles: ResolvedNodeStyles; edgeStyles: ResolvedEdgeStyles } {
  const itemOverrides = fieldConfig?.itemOverrides;

  if (!itemOverrides?.length) {
    return { nodeStyles: new Map(), edgeStyles: new Map() };
  }

  const { node, edge } = getRegistries();

  return {
    nodeStyles: applyItemOverrides<NodeItemConfig>({
      itemOverrides,
      kind: getNodeItemKind(),
      itemConfigRegistry: node,
      data,
      context,
    }),
    edgeStyles: applyItemOverrides<EdgeItemConfig>({
      itemOverrides,
      kind: getEdgeItemKind(),
      itemConfigRegistry: edge,
      data,
      context,
    }),
  };
}
