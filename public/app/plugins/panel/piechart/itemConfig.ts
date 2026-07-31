import {
  type DataFrame,
  type FieldConfigOptionsRegistry,
  FieldConfigProperty,
  type FieldConfigSource,
  type FieldDisplay,
  FieldColorModeId,
  type GrafanaTheme2,
  type ItemKindContext,
  type ItemKindDescriptor,
  type LinkModel,
  type PanelItem,
  applyItemOverrides,
  createItemConfigRegistry,
  getFieldDisplayValues,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

import { type Options } from './panelcfg.gen';

export const SLICE_ITEM_KIND = 'slice';

/**
 * Slices are keyed by their display title — the same key PieChart already uses for hover and
 * tooltip identity. With `reduceOptions.values: true` each slice is a row, so a field override
 * cannot target one; this is the gap item overrides close.
 */
export function getSliceId(display: FieldDisplay): string {
  return display.display.title ?? '';
}

/**
 * A slice only exists once the data has been reduced, which depends on the panel's reduceOptions,
 * so the kind derives its marks from the context rather than from the frames alone.
 *
 * `precomputed` lets the panel skip the second reduction: it has already called
 * getFieldDisplayValues to render, so re-running it would be wasted work.
 */
export function makeSliceKind(precomputed?: FieldDisplay[]): ItemKindDescriptor {
  return {
    id: SLICE_ITEM_KIND,
    name: t('piechart.item-kind-slices', 'Slices'),
    getItems: (data: DataFrame[], context: ItemKindContext): PanelItem[] => {
      const values = precomputed ?? getSliceDisplayValues(data, context);
      const seen = new Set<string>();
      const items: PanelItem[] = [];

      for (const value of values) {
        const id = getSliceId(value);
        // Two rows can reduce to the same title; a rule would target both, so offer it once
        if (!id || seen.has(id)) {
          continue;
        }
        seen.add(id);
        items.push({ id });
      }

      return items;
    },
    standardOptions: {
      [FieldConfigProperty.Color]: {},
      [FieldConfigProperty.Links]: {},
    },
  };
}

// The context's options are erased at the registry boundary, so narrow back to this panel's shape
function hasReduceOptions(options: unknown): options is Options {
  return typeof options === 'object' && options !== null && 'reduceOptions' in options;
}

function getSliceDisplayValues(data: DataFrame[], context: ItemKindContext): FieldDisplay[] {
  if (!hasReduceOptions(context?.options)) {
    return [];
  }

  return getFieldDisplayValues({
    fieldConfig: context.fieldConfig,
    reduceOptions: context.options.reduceOptions,
    data,
    theme: context.theme,
    replaceVariables: context.replaceVariables,
  });
}

// Built lazily: standardFieldConfigEditorRegistry is only populated at app startup.
let sliceRegistry: FieldConfigOptionsRegistry | undefined;

function getSliceRegistry(): FieldConfigOptionsRegistry {
  sliceRegistry ??= createItemConfigRegistry(makeSliceKind(), 'piechart');
  return sliceRegistry;
}

/**
 * Overlays item-override colours onto the resolved display values, in place of the palette colour.
 *
 * Writes to `display.color`, the slot both the arc renderer and the legend already read, so no
 * change is needed downstream.
 */
export function applySliceOverrides(
  fieldConfig: FieldConfigSource,
  fieldDisplayValues: FieldDisplay[],
  theme: GrafanaTheme2
): FieldDisplay[] {
  const itemOverrides = fieldConfig?.itemOverrides;

  if (!itemOverrides?.length) {
    return fieldDisplayValues;
  }

  const resolved = applyItemOverrides({
    itemOverrides,
    // The panel has already reduced the data, so hand the values straight to the kind
    kind: makeSliceKind(fieldDisplayValues),
    itemConfigRegistry: getSliceRegistry(),
    data: [],
    context: { fieldConfig, options: undefined, replaceVariables: (v: string) => v, theme },
  });

  if (!resolved.size) {
    return fieldDisplayValues;
  }

  return fieldDisplayValues.map((value) => {
    const config = resolved.get(getSliceId(value));

    if (!config) {
      return value;
    }

    let next = value;

    const fixedColor = config.color?.fixedColor;
    if (fixedColor) {
      next = {
        ...next,
        display: { ...next.display, color: theme.visualization.getColorByName(fixedColor) },
        // Keep field.color in step so the gradient grouping in PieChartPanel does not
        // re-derive a palette colour for an overridden slice.
        field: { ...next.field, color: { mode: FieldColorModeId.Fixed, ...next.field.color, ...config.color } },
      };
    }

    if (config.links?.length) {
      const overrideLinks = config.links;
      const fieldLinks = next.getLinks;
      next = {
        ...next,
        hasLinks: true,
        // Per-slice links join the field-derived ones rather than replacing them
        getLinks: (): LinkModel[] => [
          ...(fieldLinks?.() ?? []),
          ...overrideLinks.map((link) => getLinkSrv().getDataLinkUIModel(link, undefined, value)),
        ],
      };
    }

    return next;
  });
}
