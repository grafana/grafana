import { Field } from '@grafana/data';
import * as common from '@grafana/schema';

import { SeriesMapping } from './panelcfg.gen';

// panel save model
export interface XYSeriesConfig {
  name?: string;

  // required in manual mode (can match same frame multiple times)
  frame?: {
    matcher: common.MatcherConfig;
  };
  x?: {
    matcher: common.MatcherConfig;
  };
  y?: {
    matcher?: common.MatcherConfig; // include
    exclude?: common.MatcherConfig;
  };
  color?: {
    matcher: common.MatcherConfig;
  };
  size?: {
    matcher: common.MatcherConfig;
  };
}

// materialized series (internal)
export interface XYSeries {
  name: string;

  showPoints: common.VisibilityMode;

  showLine: boolean;
  lineWidth: number;
  lineStyle: common.LineStyle;

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
}

export interface Options extends common.OptionsWithLegend, common.OptionsWithTooltip {
  // source: 'annotations' | 'series', // maybe render directly from annotations (exemplars)
  mapping: SeriesMapping;
  series: XYSeriesConfig[]; // uses series[0] in auto mode to generate
}



/*
name                     // cache getFieldDisplayName

// points, lines, points+lines
show     = yField.config.custom.show  // hideFrom?

// fixed, overrideable
lineColor = yField.config.color
lineStyle = yField.config.custom.lineStyle
lineWidth = yField.config.custom.lineWidth

// fixed or dynamic
pointColor = (colorField ?? yField).config.color
pointSize =  (sizeField  ?? yField).config.custom.pointSize (fixed, min, max)
*/


/*
migration of manual, single frame

displayName override in manual mode
fixed color override in manual mode
pointsize min/max/fixed override

cue defs? seriesMapping default


legend hookup
datalinks
y labels, units, formatter?
*/
