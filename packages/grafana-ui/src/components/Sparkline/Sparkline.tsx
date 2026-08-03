import React, { memo, useCallback, useMemo, useRef } from 'react';

import { type DataFrame, type FieldConfig, type FieldSparkline } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/schema';

import { type Themeable2 } from '../../types/theme';
import { UPlotChart } from '../uPlot/Plot';
import { preparePlotData2, getStackingGroups } from '../uPlot/utils';

import { prepareSeries, prepareConfig } from './utils';

export interface SparklineProps extends Themeable2 {
  width: number;
  height: number;
  config?: FieldConfig<GraphFieldConfig>;
  sparkline: FieldSparkline;
  showHighlights?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = memo((props) => {
  const { sparkline, config: fieldConfig, theme, width, height, showHighlights } = props;
  const timeRangeRef = useRef(sparkline.timeRange);
  const alignedDataFrameRef = useRef<DataFrame | undefined>(undefined);
  timeRangeRef.current = sparkline.timeRange;

  const getTimeRange = useCallback(() => timeRangeRef.current, []);
  const getAlignedDataFrame = useCallback(() => alignedDataFrameRef.current!, []);

  const { frame: alignedDataFrame, warning } = useMemo(
    () => prepareSeries(sparkline, theme, fieldConfig, showHighlights),
    [sparkline, theme, fieldConfig, showHighlights]
  );
  alignedDataFrameRef.current = alignedDataFrame;

  const data = useMemo(
    () => (warning ? undefined : preparePlotData2(alignedDataFrame, getStackingGroups(alignedDataFrame))),
    [alignedDataFrame, warning]
  );

  const configBuilder = useMemo(
    () =>
      warning
        ? undefined
        : prepareConfig(sparkline, alignedDataFrame, theme, showHighlights, getTimeRange, getAlignedDataFrame),
    [
      sparkline.x,
      sparkline.y,
      sparkline.highlightIndex,
      fieldConfig,
      theme,
      showHighlights,
      warning,
      getTimeRange,
      getAlignedDataFrame,
    ]
  );

  if (warning || !data || !configBuilder) {
    return null;
  }

  return <UPlotChart data={data} config={configBuilder} width={width} height={height} />;
});

Sparkline.displayName = 'Sparkline';
