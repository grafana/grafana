import {
  FieldColorModeId,
  ThresholdsMode,
  VisualizationPresetsSupplier,
  VisualizationSuggestion,
  VizOrientation,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { BarGaugeDisplayMode, BarGaugeNamePlacement, BarGaugeSizing, BarGaugeValueMode } from '@grafana/schema';
import { LegendDisplayMode } from '@grafana/ui';

import { defaultOptions, Options } from './panelcfg.gen';

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
    cardOptions: {},
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
    cardOptions: {},
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
    cardOptions: {},
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
    cardOptions: {},
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
    cardOptions: {},
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
    cardOptions: {},
  };
};

export const barGaugePresetsSupplier: VisualizationPresetsSupplier<Options> = () => {
  return [
    basicHorizontalPreset(),
    basicVerticalPreset(),
    gradientHorizontalPreset(),
    lcdHorizontalPreset(),
    gradientBlYlRdPreset(),
    gradientVerticalPreset(),
  ];
};
