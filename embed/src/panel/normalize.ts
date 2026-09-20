import { type FieldConfigSource } from '@grafana/data';

/** What the renderer needs, extracted from whichever panel shape the host supplied. */
export interface EmbedPanel {
  pluginId: string;
  title?: string;
  options: Record<string, unknown>;
  fieldConfig: FieldConfigSource;
}

const EMPTY_FIELD_CONFIG: FieldConfigSource = { defaults: {}, overrides: [] };

interface VizConfigInput {
  group?: string;
  spec?: {
    options?: Record<string, unknown>;
    fieldConfig?: FieldConfigSource;
  };
}

/**
 * Dashboard v2 panel element. `vizConfig.group` carries the plugin id and
 * `vizConfig.version` the plugin version; this is the shape Notebook produces and the
 * one spec.elements stores. Queries (spec.data) are deliberately ignored: the host
 * owns data.
 */
export interface PanelKindInput {
  kind: 'Panel';
  spec?: {
    title?: string;
    vizConfig?: VizConfigInput;
  };
}

/** Classic v1 panel JSON, accepted because most panel JSON in the wild is still v1. */
export interface PanelV1Input {
  type: string;
  title?: string;
  options?: Record<string, unknown>;
  fieldConfig?: FieldConfigSource;
}

export type EmbedPanelInput = PanelKindInput | PanelV1Input;

/**
 * Returns undefined for anything that does not carry a panel type, so a host setting
 * a half-built object gets an "unsupported panel type" message rather than a crash.
 * The checks are runtime guards as much as narrowing: the property is set from
 * ordinary JavaScript, which the type system does not police.
 */
export function normalizePanel(input: EmbedPanelInput | null | undefined): EmbedPanel | undefined {
  if (typeof input !== 'object' || input === null) {
    return undefined;
  }

  if ('kind' in input && input.kind === 'Panel') {
    const viz = input.spec?.vizConfig;
    if (typeof viz?.group !== 'string' || viz.group === '') {
      return undefined;
    }
    return {
      pluginId: viz.group,
      title: input.spec?.title,
      options: viz.spec?.options ?? {},
      fieldConfig: viz.spec?.fieldConfig ?? EMPTY_FIELD_CONFIG,
    };
  }

  if ('type' in input && typeof input.type === 'string' && input.type !== '') {
    return {
      pluginId: input.type,
      title: input.title,
      options: input.options ?? {},
      fieldConfig: input.fieldConfig ?? EMPTY_FIELD_CONFIG,
    };
  }

  return undefined;
}
