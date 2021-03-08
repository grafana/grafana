import React, { useCallback } from 'react';
import { PieChart, useTheme } from '@grafana/ui';
import { PieChartOptions } from './types';
import { getFieldDisplayValues, PanelProps } from '@grafana/data';
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

  const values = getFieldDisplayValues({
    fieldConfig,
    reduceOptions: options.reduceOptions,
    data: data.series,
    theme: useTheme(),
    replaceVariables: replaceVariables,
    timeZone,
  }).map((v) => v.display);

  return (
    <PieChart
      width={width}
      height={height}
      values={values}
      onSeriesColorChange={onSeriesColorChange}
      pieType={options.pieType}
      displayLabels={options.displayLabels}
      legendOptions={options.legend}
    />
  );
};
