import React, { memo } from 'react';

import { FieldConfig, FieldSparkline } from '@grafana/data';
import { GraphFieldConfig } from '@grafana/schema';

import { Themeable2 } from '../../types/theme';
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

  const { frame: alignedDataFrame, warning } = prepareSeries(sparkline, theme, fieldConfig, showHighlights);
  if (warning) {
    return null;
  }

  const data = preparePlotData2(alignedDataFrame, getStackingGroups(alignedDataFrame));
  const configBuilder = prepareConfig(sparkline, alignedDataFrame, theme, showHighlights);

  return <UPlotChart data={data} config={configBuilder} width={width} height={height} />;
});

Sparkline.displayName = 'Sparkline';
