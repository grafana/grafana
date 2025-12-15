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
}

const SparklineFn: React.FC<SparklineProps> = memo((props) => {
  const { sparkline, config: fieldConfig, theme, width, height } = props;

  const { frame: alignedDataFrame, warning } = prepareSeries(sparkline, fieldConfig);
  if (warning) {
    return null;
  }

  const data = preparePlotData2(alignedDataFrame, getStackingGroups(alignedDataFrame));
  const configBuilder = prepareConfig(sparkline, alignedDataFrame, theme);

  return <UPlotChart data={data} config={configBuilder} width={width} height={height} />;
});

SparklineFn.displayName = 'Sparkline';

// we converted to function component above, but some apps extend Sparkline, so we need
// to keep exporting a class component until those apps are all rolled out.
// see https://github.com/grafana/app-observability-plugin/pull/2079
// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
export class Sparkline extends React.PureComponent<SparklineProps> {
  render() {
    return <SparklineFn {...this.props} />;
  }
}
