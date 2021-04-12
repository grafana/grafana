import React from 'react';
import { AlignedData } from 'uplot';
import {
  compareArrayValues,
  compareDataFrameStructures,
  DataFrame,
  DataFrameFieldIndex,
  FieldType,
  TimeRange,
  TimeZone,
  XYFieldMatchers,
} from '@grafana/data';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent } from './types';
import { preparePlotConfigBuilder } from './utils';
import { preparePlotData } from '../uPlot/utils';
import { PlotLegend } from '../uPlot/PlotLegend';
import { UPlotChart } from '../uPlot/Plot';
import { LegendDisplayMode, VizLegendOptions } from '../VizLegend/models.gen';
import { VizLayout } from '../VizLayout/VizLayout';

/**
 * @internal -- not a public API
 */
export const FIXED_UNIT = '__fixed';

export interface GraphNGProps extends Themeable {
  width: number;
  height: number;
  data: DataFrame;
  timeRange: TimeRange;
  legend: VizLegendOptions;
  timeZone: TimeZone;
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
  children?: React.ReactNode;
}

/**
 * @internal -- not a public API
 */
export interface GraphNGState {
  data: AlignedData;
  seriesToDataFrameFieldIndexMap: DataFrameFieldIndex[];
  config?: UPlotConfigBuilder;
}

class UnthemedGraphNG extends React.Component<GraphNGProps, GraphNGState> {
  constructor(props: GraphNGProps) {
    super(props);
    this.state = {} as GraphNGState;
  }

  componentDidMount() {
    const { theme, data } = this.props;

    if (!data) {
      return;
    }
    const plotData = preparePlotData(data, [FieldType.string]);
    const config = preparePlotConfigBuilder(data, theme, this.getTimeRange, this.getTimeZone);

    this.setState({
      data: plotData,
      config,
    });
  }

  componentDidUpdate(prevProps: GraphNGProps) {
    const { data, theme } = this.props;
    let shouldConfigUpdate = false;

    let stateUpdate = {} as GraphNGState;

    if (this.state.config === undefined || this.props.timeZone !== prevProps.timeZone) {
      shouldConfigUpdate = true;
    }

    if (data !== prevProps.data) {
      const hasStructureChanged = !compareArrayValues([data], [prevProps.data], compareDataFrameStructures);

      if (shouldConfigUpdate || hasStructureChanged) {
        const builder = preparePlotConfigBuilder(data, theme, this.getTimeRange, this.getTimeZone);
        stateUpdate = { ...stateUpdate, config: builder };
      }
    }

    if (Object.keys(stateUpdate).length > 0) {
      this.setState({ ...stateUpdate, data: preparePlotData(data, [FieldType.string]) });
    }
  }

  getTimeRange = () => {
    return this.props.timeRange;
  };

  getTimeZone = () => {
    return this.props.timeZone;
  };

  renderLegend() {
    const { legend, onSeriesColorChange, onLegendClick, data } = this.props;
    const { config } = this.state;

    if (!config || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
      return;
    }

    return (
      <PlotLegend
        data={[data]}
        config={config}
        onSeriesColorChange={onSeriesColorChange}
        onLegendClick={onLegendClick}
        maxHeight="35%"
        maxWidth="60%"
        {...legend}
      />
    );
  }

  render() {
    const { width, height, children, timeZone, timeRange, ...plotProps } = this.props;

    if (!this.state.data || !this.state.config) {
      return null;
    }

    return (
      <VizLayout width={width} height={height} legend={this.renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            {...plotProps}
            config={this.state.config!}
            data={this.state.data}
            width={vizWidth}
            height={vizHeight}
            timeRange={timeRange}
          >
            {children}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}

export const GraphNG = withTheme(UnthemedGraphNG);
GraphNG.displayName = 'GraphNG';
