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

/**
 * Basic horizontal preset - thresholds coloring
 */
const basicHorizontalPreset = (): VisualizationSuggestion<Options> => {
  return {
    name: t('bargauge.presets.basic', 'Basic'),
    // description: t('bargauge.presets.basic_desc', 'Basic, color from thresholds'),
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
        thresholds: {
          mode: ThresholdsMode.Percentage,
          steps: [
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            { value: null as unknown as number, color: 'green' },
            { value: 60, color: 'orange' },
            { value: 80, color: 'red' },
          ],
        },
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
    // description: t('bargauge.presets.basic-vertical_desc', 'Basic, color from thresholds, vertical'),
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
        thresholds: {
          mode: ThresholdsMode.Percentage,
          steps: [
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            { value: null as unknown as number, color: 'green' },
            { value: 60, color: 'orange' },
            { value: 80, color: 'red' },
          ],
        },
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
    // description: t('bargauge.presets.gradient_desc', 'Gradient, color from thresholds, text color'),
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
        thresholds: {
          mode: ThresholdsMode.Percentage,
          steps: [
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            { value: null as unknown as number, color: 'green' },
            { value: 60, color: 'orange' },
            { value: 80, color: 'red' },
          ],
        },
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
    // description: t('bargauge.presets.retro-lcd_desc', 'Color scale, text color'),
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
    // description: t('bargauge.presets.gradient-BlYlRd_desc', 'Color scale, value color'),
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
    // description: t('bargauge.presets.gradient-vertical_desc', 'color scale, unchecked show unfilled'),
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
        thresholds: {
          mode: ThresholdsMode.Percentage,
          steps: [
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            { value: null as unknown as number, color: 'green' },
            { value: 60, color: 'orange' },
            { value: 80, color: 'red' },
          ],
        },
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
