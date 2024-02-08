import { Field } from '@grafana/data';
import * as common from '@grafana/schema';

export enum SeriesMapping2 {
  Auto = 'auto',
  Manual = 'manual',
}

// panel save model
export interface XYSeriesConfig {
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
      exclude?: common.MatcherConfig;
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

// materialized series (internal)
export interface XYSeries {
  name: string;

  x: {
    field: {
      value: Field;
    };
  };
  y: {
    field: {
      value: Field
    };
  };
  color: {
    fixed: {
      value: string;
    };

    field?: {
      value: Field
    };
  };
  size: {  // if absent, falls back to mode: area, fixed.value: 5px
    // mode: 'area' | 'dia';

    fixed: {
      value: number;
    };

    field?: {
      value: Field;

      // pixels range
      min: number;
      max: number;
    };
  };
}

export interface Options extends common.OptionsWithLegend, common.OptionsWithTooltip {
  // source: 'annotations' | 'series', // maybe render directly from annotations (exemplars)
  mapping: SeriesMapping2;
  series: XYSeriesConfig[]; // uses series[0] in auto mode to generate
}

// temp mock for testing
export interface PanelOpts {
  mapping: SeriesMapping2;
  series: XYSeriesConfig[]; // uses series[0] in auto mode to generate
}
