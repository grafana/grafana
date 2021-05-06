import React from 'react';
import { PieChart } from '@grafana/ui';
import { PieChartOptions } from './types';
import { PanelProps } from '@grafana/data';

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
  return (
    <PieChart
      width={width}
      height={height}
      timeZone={timeZone}
      fieldConfig={fieldConfig}
      reduceOptions={options.reduceOptions}
      replaceVariables={replaceVariables}
      data={data.series}
      pieType={options.pieType}
      displayLabels={options.displayLabels}
      legendOptions={options.legend}
      tooltipOptions={options.tooltip}
    />
  );
};
