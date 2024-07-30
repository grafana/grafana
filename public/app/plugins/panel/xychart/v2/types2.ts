import { Field } from '@grafana/data';
import * as common from '@grafana/schema';

import { PointShape } from './panelcfg.gen';

// import { SeriesMapping, XYSeriesConfig } from './panelcfg.gen';

// // panel save model
// export interface XYSeriesConfig {
//   name?: {
//     fixed?: string; // (if explicitly defined in manual mode)

//   /*
//     replace?: {
//       // default: 'field'
//       source: 'field' | 'frame';
//       // default: whatever is matched for y field
//       matcher: common.MatcherConfig;
//       // default: 'displayName'
//       prop: 'displayName' | 'name' | 'query' | 'target';

//       // similar to renameByRegex & RenameByRegexTransformerOptions
//       // default: '(.*)'
//       regex: string;
//       // default: '$1'
//       rename: string;
//     }
//   */
//   }

//   // required in manual mode (can match same frame multiple times)
//   frame?: {
//     matcher: common.MatcherConfig;
//   };
//   x?: {
//     matcher: common.MatcherConfig;
//   };
//   y?: {
//     matcher: common.MatcherConfig;
//   };
//   color?: {
//     matcher: common.MatcherConfig;
//   };
//   size?: {
//     matcher: common.MatcherConfig;
//   };
// }

// materialized series (internal)
export interface XYSeries {
  showPoints: common.VisibilityMode;
  pointShape: PointShape;
  pointStrokeWidth: number;
  fillOpacity: number;

  showLine: boolean;
  lineWidth: number;
  lineStyle: common.LineStyle;

  name: {
    // extracted from fieldConfig + overrides of y field
    value: string;
  };
  x: {
    field: Field;
  };
  y: {
    field: Field;
  };
  color: {
    field?: Field;

    // fixed value extracted from fieldConfig + overrides of y field
    fixed?: string;
  };
  size: {
    field?: Field;
    // extracted from fieldConfig + overrides of size field
    min?: number;
    max?: number;

    // fixed value extracted from fieldConfig + overrides of y field
    fixed?: number;
  };
  // remaining unmapped fields in this frame (for showing remaining fields in tooltip)
  _rest: Field[];
}

// export interface Options extends common.OptionsWithLegend, common.OptionsWithTooltip {
//   // source: 'annotations' | 'series', // maybe render directly from annotations (exemplars)
//   mapping: SeriesMapping;
//   series: XYSeriesConfig[]; // uses series[0] in auto mode to generate
// }
