import { FieldType } from '@grafana/data/dataframe';
import {
  FieldColorModeId,
  ThresholdsMode,
  type VisualizationPresetsSupplier,
  type VisualizationSuggestion,
  VizOrientation,
} from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { BarGaugeDisplayMode, BarGaugeNamePlacement, BarGaugeSizing, BarGaugeValueMode } from '@grafana/schema';
import { LegendDisplayMode } from '@grafana/ui';

import { defaultOptions, type Options } from './panelcfg.gen';
import { BARGAUGE_CARD_OPTIONS } from './suggestions';

const defaultPresetThresholds = {
  mode: ThresholdsMode.Percentage,
  steps: [
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    { value: null as unknown as number, color: 'green' },
    { value: 60, color: 'orange' },
    { value: 80, color: 'red' },
  ],
};

/**
 * Basic horizontal preset - thresholds coloring
 */
const basicHorizontalPreset = (): VisualizationSuggestion<Options> => {
  return {
    name: t('bargauge.presets.basic', 'Basic'),
    description: t('bargauge.presets.basic_desc', 'Horizontal bars, value color from thresholds'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Horizontal,
      displayMode: BarGaugeDisplayMode.Basic,
      valueMode: BarGaugeValueMode.Color,
      namePlacement: BarGaugeNamePlacement.Auto,
      showUnfilled: true,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 8,
      minVizHeight: 16,
      maxVizHeight: 300,
      reduceOptions: {
        values: false,
        calcs: ['lastNotNull'],
        fields: '',
      },
      legend: {
        showLegend: false,
        displayMode: LegendDisplayMode.List,
        placement: 'bottom',
        calcs: [],
      },
    },
    fieldConfig: {
      defaults: {
        thresholds: defaultPresetThresholds,
        color: {
          mode: FieldColorModeId.Thresholds,
        },
      },
      overrides: [],
    },
    cardOptions: BARGAUGE_CARD_OPTIONS,
  };
};

/**
 * Basic vertical preset - thresholds coloring, text value display
 */
const basicVerticalPreset = (): VisualizationSuggestion<Options> => {
  return {
    name: t('bargauge.presets.basic-vertical', 'Basic vertical'),
    description: t('bargauge.presets.basic-vertical_desc', 'Vertical bars, threshold color, text value'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Vertical,
      displayMode: BarGaugeDisplayMode.Basic,
      valueMode: BarGaugeValueMode.Text,
      namePlacement: BarGaugeNamePlacement.Auto,
      showUnfilled: true,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 8,
      minVizHeight: 16,
      maxVizHeight: 300,
      reduceOptions: {
        values: false,
        calcs: ['lastNotNull'],
        fields: '',
      },
      legend: {
        showLegend: false,
        displayMode: LegendDisplayMode.List,
        placement: 'bottom',
        calcs: [],
      },
    },
    fieldConfig: {
      defaults: {
        thresholds: defaultPresetThresholds,
        color: {
          mode: FieldColorModeId.Thresholds,
        },
      },
      overrides: [],
    },
    cardOptions: BARGAUGE_CARD_OPTIONS,
  };
};

/**
 * Gradient horizontal preset - thresholds coloring, text value display
 */
const gradientHorizontalPreset = (): VisualizationSuggestion<Options> => {
  return {
    name: t('bargauge.presets.gradient', 'Gradient'),
    description: t('bargauge.presets.gradient_desc', 'Horizontal bars, gradient fill from thresholds'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Horizontal,
      displayMode: BarGaugeDisplayMode.Gradient,
      valueMode: BarGaugeValueMode.Text,
      namePlacement: BarGaugeNamePlacement.Auto,
      showUnfilled: true,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 8,
      minVizHeight: 16,
      maxVizHeight: 300,
      reduceOptions: {
        values: false,
        calcs: ['lastNotNull'],
        fields: '',
      },
      legend: {
        showLegend: false,
        displayMode: LegendDisplayMode.List,
        placement: 'bottom',
        calcs: [],
      },
    },
    fieldConfig: {
      defaults: {
        thresholds: defaultPresetThresholds,
        color: {
          mode: FieldColorModeId.Thresholds,
        },
      },
      overrides: [],
    },
    cardOptions: BARGAUGE_CARD_OPTIONS,
  };
};

/**
 * Retro LCD horizontal preset - continuous color
 */
const lcdHorizontalPreset = (): VisualizationSuggestion<Options> => {
  return {
    name: t('bargauge.presets.retro-lcd', 'Retro LCD'),
    description: t('bargauge.presets.retro-lcd_desc', 'Horizontal, LCD style, green-yellow-red scale'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Horizontal,
      displayMode: BarGaugeDisplayMode.Lcd,
      valueMode: BarGaugeValueMode.Text,
      namePlacement: BarGaugeNamePlacement.Auto,
      showUnfilled: true,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 8,
      minVizHeight: 16,
      maxVizHeight: 300,
      reduceOptions: {
        values: false,
        calcs: ['lastNotNull'],
        fields: '',
      },
      legend: {
        showLegend: false,
        displayMode: LegendDisplayMode.List,
        placement: 'bottom',
        calcs: [],
      },
    },
    fieldConfig: {
      defaults: {
        color: {
          mode: FieldColorModeId.ContinuousGrYlRd,
        },
      },
      overrides: [],
    },
    cardOptions: BARGAUGE_CARD_OPTIONS,
  };
};

/**
 * Gradient blue-yellow-red horizontal preset - continuous color
 */
const gradientBlYlRdPreset = (): VisualizationSuggestion<Options> => {
  return {
    name: t('bargauge.presets.gradient-BlYlRd', 'Gradient blue-red'),
    description: t('bargauge.presets.gradient-BlYlRd_desc', 'Horizontal, gradient fill, blue-yellow-red scale'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Horizontal,
      displayMode: BarGaugeDisplayMode.Gradient,
      valueMode: BarGaugeValueMode.Color,
      namePlacement: BarGaugeNamePlacement.Auto,
      showUnfilled: true,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 8,
      minVizHeight: 16,
      maxVizHeight: 300,
      reduceOptions: {
        values: false,
        calcs: ['lastNotNull'],
        fields: '',
      },
      legend: {
        showLegend: false,
        displayMode: LegendDisplayMode.List,
        placement: 'bottom',
        calcs: [],
      },
    },
    fieldConfig: {
      defaults: {
        color: {
          mode: FieldColorModeId.ContinuousBlYlRd,
        },
      },
      overrides: [],
    },
    cardOptions: BARGAUGE_CARD_OPTIONS,
  };
};

/**
 * Gradient vertical preset - continuous GrYlRd color, filled bars
 */
const gradientVerticalPreset = (): VisualizationSuggestion<Options> => {
  return {
    name: t('bargauge.presets.gradient-vertical', 'Gradient vertical'),
    description: t('bargauge.presets.gradient-vertical_desc', 'Vertical, gradient fill, no unfilled track'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Vertical,
      displayMode: BarGaugeDisplayMode.Gradient,
      valueMode: BarGaugeValueMode.Color,
      namePlacement: BarGaugeNamePlacement.Auto,
      showUnfilled: false,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 8,
      minVizHeight: 16,
      maxVizHeight: 300,
      reduceOptions: {
        values: false,
        calcs: ['lastNotNull'],
        fields: '',
      },
      legend: {
        showLegend: false,
        displayMode: LegendDisplayMode.List,
        placement: 'bottom',
        calcs: [],
      },
    },
    fieldConfig: {
      defaults: {
        thresholds: defaultPresetThresholds,
        color: {
          mode: FieldColorModeId.ContinuousGrYlRd,
        },
      },
      overrides: [],
    },
    cardOptions: BARGAUGE_CARD_OPTIONS,
  };
};

export const barGaugePresetsSupplier: VisualizationPresetsSupplier<Options> = ({ dataSummary }) => {
  if (!dataSummary?.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return [];
  }

  return [
    basicHorizontalPreset(),
    basicVerticalPreset(),
    gradientHorizontalPreset(),
    lcdHorizontalPreset(),
    gradientBlYlRdPreset(),
    gradientVerticalPreset(),
  ];
};
