import React, { useCallback } from 'react';
import { PieChart } from '@grafana/ui';
import { PieChartOptions } from './types';
import { PanelProps } from '@grafana/data';
import { changeSeriesColorConfigFactory } from '../timeseries/overrides/colorSeriesConfigFactory';

interface Props extends PanelProps<PieChartOptions> {}

export const PieChartPanel: React.FC<Props> = ({
  width,
  height,
  options,
  data,
  onFieldConfigChange,
  replaceVariables,
  fieldConfig,
  timeZone,
}) => {
  const onSeriesColorChange = useCallback(
    (label: string, color: string) => {
      onFieldConfigChange(changeSeriesColorConfigFactory(label, color, fieldConfig));
    },
    [fieldConfig, onFieldConfigChange]
  );

  return (
    <PieChart
      width={width}
      height={height}
      timeZone={timeZone}
      fieldConfig={fieldConfig}
      reduceOptions={options.reduceOptions}
      replaceVariables={replaceVariables}
      data={data.series}
      onSeriesColorChange={onSeriesColorChange}
      pieType={options.pieType}
      displayLabels={options.displayLabels}
      legendOptions={options.legend}
    />
  );
};
