import { t } from '@grafana/i18n';

import { type FieldConfigSource } from '../types/fieldOverrides';
import { type IconName } from '../types/icon';
import { getValueFormats } from '../valueFormats/valueFormats';

/**
 * What a quick edit shows as its current value, e.g. in its button's tooltip.
 *
 * @alpha
 */
export interface PanelQuickEditSummary {
  text: string;
  /** Colours drawn as small swatches under the icon, e.g. a panel's threshold colours. */
  swatches?: string[];
}

/** @alpha */
export interface PanelQuickEditContext<TOptions = unknown, TFieldConfigOptions = unknown> {
  options: TOptions;
  fieldConfig: FieldConfigSource<TFieldConfigOptions>;
}

/**
 * A group of options people often change together, offered outside the full options editor, e.g. Unit with
 * Decimals. Core renders each option with the full editor's own control.
 *
 * @alpha
 */
export interface PanelQuickEdit<TOptions = unknown, TFieldConfigOptions = unknown> {
  /** Names the quick edit, e.g. in telemetry. It does not need to match an option id. */
  id: string;
  title: string;
  icon: IconName;
  /**
   * The ids of the options to show, in order, as the options editor names them: a panel option's path, a standard
   * field option's name, or `custom.` followed by the path of one of the plugin's own field options. Ids a panel
   * does not offer, e.g. a standard option the plugin disables, are left out.
   */
  optionIds: string[];
  /**
   * Names for options whose own name is unclear outside the full editor, where it relies on its category, by option
   * id. E.g. Value under a Text size category reads better as Value size on its own. The full editor is unchanged.
   */
  labels?: Partial<Record<string, string>>;
  /** Shows the plugin's presets instead of options. Left out for plugins without a presets supplier. */
  presets?: boolean;
  summary?: (context: PanelQuickEditContext<TOptions, TFieldConfigOptions>) => PanelQuickEditSummary;
}

/** @alpha */
export type PanelQuickEditsSupplier<TOptions = unknown, TFieldConfigOptions = unknown> = () => Array<
  PanelQuickEdit<TOptions, TFieldConfigOptions>
>;

/**
 * Unit and Decimals.
 *
 * @alpha
 */
export function unitQuickEdit(): PanelQuickEdit {
  return {
    id: 'unit',
    title: t('grafana-data.quick-edits.unit.title', 'Unit'),
    icon: 'ruler-combined',
    optionIds: ['unit', 'decimals'],
    summary: ({ fieldConfig }) => {
      const { unit, decimals } = fieldConfig.defaults;
      const name = unit ? getUnitName(unit) : t('grafana-data.quick-edits.unit.none', 'None');
      if (decimals == null) {
        return { text: name };
      }
      return {
        text: t('grafana-data.quick-edits.unit.with-decimals', '', {
          unit: name,
          count: decimals,
          defaultValue_one: '{{unit}}, {{count}} decimal',
          defaultValue_other: '{{unit}}, {{count}} decimals',
        }),
      };
    },
  };
}

/**
 * Min and Max.
 *
 * @alpha
 */
export function rangeQuickEdit(): PanelQuickEdit {
  return {
    id: 'range',
    title: t('grafana-data.quick-edits.range.title', 'Min / Max'),
    icon: 'arrows-v',
    optionIds: ['min', 'max'],
    summary: ({ fieldConfig }) => {
      const { min, max } = fieldConfig.defaults;
      const auto = t('grafana-data.quick-edits.range.auto', 'Auto');
      if (min == null && max == null) {
        return { text: auto };
      }
      return { text: `${min ?? auto} – ${max ?? auto}` };
    },
  };
}

/**
 * Thresholds, followed by any options of the plugin's own that belong with them, e.g. how they are drawn.
 *
 * @alpha
 */
export function thresholdsQuickEdit(extraOptionIds: string[] = []): PanelQuickEdit {
  return {
    id: 'thresholds',
    title: t('grafana-data.quick-edits.thresholds.title', 'Thresholds'),
    icon: 'sliders-v-alt',
    optionIds: ['thresholds', ...extraOptionIds],
    summary: ({ fieldConfig }) => {
      const steps = fieldConfig.defaults.thresholds?.steps ?? [];
      const values = steps.slice(1).map((step) => String(step.value));
      return {
        text: values.length ? values.join(' · ') : t('grafana-data.quick-edits.thresholds.base-only', 'Base only'),
        swatches: steps.map((step) => step.color),
      };
    },
  };
}

/**
 * The plugin's presets.
 *
 * @alpha
 */
export function presetsQuickEdit(): PanelQuickEdit {
  return {
    id: 'presets',
    title: t('grafana-data.quick-edits.presets.title', 'Style'),
    icon: 'palette',
    optionIds: [],
    presets: true,
  };
}

function getUnitName(id: string): string {
  for (const category of getValueFormats()) {
    const match = category.submenu?.find((format) => format.value === id);
    if (match) {
      return match.text;
    }
  }
  return id;
}
