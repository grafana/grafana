import React, { useCallback, useState } from 'react';
import { PieChart } from '@grafana/ui';
import { PieChartOptions } from './types';
import { EventBusWithSourceContext, EventBusWithSource, PanelProps } from '@grafana/data';
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
  eventBus,
  id,
}) => {
  const onSeriesColorChange = useCallback(
    (label: string, color: string) => {
      onFieldConfigChange(changeSeriesColorConfigFactory(label, color, fieldConfig));
    },
    [fieldConfig, onFieldConfigChange]
  );

  const [eventBusWithSource] = useState<EventBusWithSource>(new EventBusWithSource(eventBus, id.toString(10)));

  return (
    <EventBusWithSourceContext.Provider value={eventBusWithSource}>
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
        tooltipOptions={options.tooltip}
      />
    </EventBusWithSourceContext.Provider>
  );
};
