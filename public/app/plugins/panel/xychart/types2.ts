import * as common from '@grafana/schema';

export enum SeriesMapping {
  Auto = 'auto',
  Manual = 'manual',
}

interface XYSeriesConfig {
  name?: string; // if absent, gets name from y field

  // required in manual mode (can match same frame multiple times)
  frame?: common.MatcherConfig;

  x: {
    field: {
      matcher: common.MatcherConfig;
    };
  };
  y: {
    field: {
      matcher: common.MatcherConfig; // include
      exclude: common.MatcherConfig;
    };
  };
  color?: {  // if absent, falls back to classic palette index
    fixed?: {
      value?: string; // if absent, falls back to classic palette index
    };

    field?: {
      matcher: common.MatcherConfig;
    };
  };
  size?: {  // if absent, falls back to mode: area, fixed.value: 5px
    // mode: 'area' | 'dia';

    fixed?: {
      value?: number; // if absent, falls back to 5px
    };

    field?: {
      matcher: common.MatcherConfig;

      // pixels range
      min?: number; // default to 5px
      max?: number; // default to 100px
    };
  };
}

export interface Options extends common.OptionsWithLegend, common.OptionsWithTooltip {
  // source: 'annotations' | 'series', // maybe render directly from annotations (exemplars)
  mapping: SeriesMapping;
  series: XYSeriesConfig[]; // uses series[0] in auto mode to generate
}
