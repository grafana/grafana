import React from 'react';
import { withTheme } from '../../themes';
import { DataFrame } from '@grafana/data';
import { GraphNG, GraphNGProps } from '../GraphNG/GraphNG';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { PlotLegend } from '../uPlot/PlotLegend';
import { LegendDisplayMode } from '../VizLegend/models.gen';
import { preparePlotConfigBuilder } from '../GraphNG/utils';

type TimeSeriesProps = Omit<GraphNGProps, 'shouldReconfig' | 'addlProps' | 'renderLegend'>;

const shouldReconfig = (prevProps: GraphNGProps, props?: GraphNGProps) => {
  return false;
};

const addlProps = (props: GraphNGProps) => {
  return props;
};

const renderLegend = (props: GraphNGProps, config: UPlotConfigBuilder, alignedDataFrame: DataFrame) => {
  const { legend, onSeriesColorChange, onLegendClick, frames } = props;

  if (!config || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
    return;
  }

  return (
    <PlotLegend
      data={frames}
      config={config}
      onSeriesColorChange={onSeriesColorChange}
      onLegendClick={onLegendClick}
      maxHeight="35%"
      maxWidth="60%"
      {...legend}
    />
  );
};

export class UnthemedTimeSeries extends React.Component<TimeSeriesProps> {
  render() {
    return (
      <GraphNG
        {...this.props}
        prepConfig={preparePlotConfigBuilder}
        shouldReconfig={shouldReconfig}
        addlProps={addlProps}
        renderLegend={renderLegend}
      />
    );
  }
}

export const TimeSeries = withTheme(UnthemedTimeSeries);
TimeSeries.displayName = 'TimeSeries';
