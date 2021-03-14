import React from 'react';
import { GraphNGLegendEventMode, XYFieldMatchers } from '../GraphNG/types';
import {
  DataFrame,
  FieldConfig,
  getFieldDisplayName,
  GrafanaTheme,
  outerJoinDataFrames,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { TimelineCoreOptions, getConfig } from './timeline';
import { FIXED_UNIT } from '../GraphNG/GraphNG';
import { AxisPlacement, GraphGradientMode, ScaleDirection, ScaleOrientation } from '../uPlot/config';

import { TimelineFieldConfig } from '../..';
import { TimelineMode } from './types';

const defaultConfig: TimelineFieldConfig = {
  lineWidth: 0,
  fillOpacity: 80,
  gradientMode: GraphGradientMode.None,
};

export function mapMouseEventToMode(event: React.MouseEvent): GraphNGLegendEventMode {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    return GraphNGLegendEventMode.AppendToSelection;
  }
  return GraphNGLegendEventMode.ToggleSelection;
}

export function preparePlotFrame(data: DataFrame[], dimFields: XYFieldMatchers) {
  return outerJoinDataFrames({
    frames: data,
    joinBy: dimFields.x,
    keep: dimFields.y,
    keepOriginIndices: true,
  });
}

export type uPlotConfigBuilderSupplier = (
  frame: DataFrame,
  theme: GrafanaTheme,
  getTimeRange: () => TimeRange,
  getTimeZone: () => TimeZone
) => UPlotConfigBuilder;

export function preparePlotConfigBuilder(
  frame: DataFrame,
  theme: GrafanaTheme,
  getTimeRange: () => TimeRange,
  getTimeZone: () => TimeZone
): UPlotConfigBuilder {
  const builder = new UPlotConfigBuilder(getTimeZone);

  const opts: TimelineCoreOptions = {
    count: frame.fields.length - 1, // number of series/lanes

    // should expose in panel config
    mode: TimelineMode.Spans,
    laneWidth: 0.9,

    /** used only for Grid mode, should expose in panel config */
    align: 0,
    size: [0.9, 100],

    label: (seriesIdx) => 'Device ' + seriesIdx,

    // hardcoded color mappings for states 0,1,2,3,<other>
    fill: (seriesIdx, valueIdx, value) =>
      value === 0 ? 'red' : value === 1 ? 'orange' : value === 2 ? 'yellow' : value === 3 ? 'green' : 'black',

    stroke: (seriesIdx, valueIdx, value) =>
      value === 0 ? 'red' : value === 1 ? 'orange' : value === 2 ? 'yellow' : value === 3 ? 'green' : 'black',

    // hardcoded formatter for state values
    formatValue: (seriesIdx, value) => 'S' + value,

    // TODO: unimplemeted for now
    onHover: (seriesIdx: number, valueIdx: number) => {
      console.log('hover', { seriesIdx, valueIdx });
    },
    onLeave: (seriesIdx: number, valueIdx: number) => {
      console.log('leave', { seriesIdx, valueIdx });
    },
  };

  const coreConfig = getConfig(opts);

  builder.addHook('init', coreConfig.init);
  builder.addHook('drawClear', coreConfig.drawClear);
  builder.addHook('setCursor', coreConfig.setCursor);

  builder.setCursor(coreConfig.cursor);

  builder.addScale({
    scaleKey: 'x',
    isTime: true,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    range: () => {
      const r = getTimeRange();
      return [r.from.valueOf(), r.to.valueOf()];
    },
  });

  builder.addScale({
    scaleKey: FIXED_UNIT, // y
    isTime: false,
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
    range: coreConfig.yRange,
  });

  builder.addAxis({
    scaleKey: 'x',
    isTime: true,
    placement: AxisPlacement.Bottom,
    timeZone: getTimeZone(),
    theme,
  });

  builder.addAxis({
    scaleKey: FIXED_UNIT, // y
    isTime: false,
    placement: AxisPlacement.Left,
    splits: coreConfig.ySplits,
    values: coreConfig.yValues,
    grid: false,
    ticks: false,
    gap: 15,
    size: 70, // should compute from series label measureText length
    theme,
  });

  let seriesIndex = 0;

  for (let i = 0; i < frame.fields.length; i++) {
    if (i === 0) {
      continue;
    }

    const field = frame.fields[i];
    const config = field.config as FieldConfig<TimelineFieldConfig>;
    const customConfig: TimelineFieldConfig = {
      ...defaultConfig,
      ...config.custom,
    };

    field.state!.seriesIndex = seriesIndex++;

    //const scaleKey = config.unit || FIXED_UNIT;
    //const colorMode = getFieldColorModeForField(field);

    let { fillOpacity } = customConfig;

    builder.addSeries({
      scaleKey: FIXED_UNIT,
      pathBuilder: coreConfig.drawPaths,
      pointsBuilder: coreConfig.drawPaths as any,
      //colorMode,
      fillOpacity,
      theme,
      show: !customConfig.hideFrom?.graph,
      thresholds: config.thresholds,

      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      dataFrameFieldIndex: field.state?.origin,
      fieldName: getFieldDisplayName(field, frame),
      hideInLegend: customConfig.hideFrom?.legend,
    });
  }

  return builder;
}

export function getNamesToFieldIndex(frame: DataFrame): Map<string, number> {
  const names = new Map<string, number>();
  for (let i = 0; i < frame.fields.length; i++) {
    names.set(getFieldDisplayName(frame.fields[i], frame), i);
  }
  return names;
}
