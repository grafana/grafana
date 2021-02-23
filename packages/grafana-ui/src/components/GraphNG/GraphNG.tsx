import React from 'react';
import { AlignedData } from 'uplot';
import {
  compareArrayValues,
  compareDataFrameStructures,
  DataFrame,
  DataFrameFieldIndex,
  FieldMatcherID,
  fieldMatchers,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { GraphNGContext } from './hooks';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { preparePlotData } from '../uPlot/utils';
import { PlotLegend } from '../uPlot/PlotLegend';
import { UPlotChart } from '../uPlot/Plot';
import { LegendDisplayMode, VizLegendOptions } from '../VizLegend/types';
import { VizLayout } from '../VizLayout/VizLayout';

export const FIXED_UNIT = '__fixed';

export interface GraphNGProps extends Themeable {
  width: number;
  height: number;
  data: DataFrame[];
  timeRange: TimeRange;
  legend: VizLegendOptions;
  timeZone: TimeZone;
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
  children?: React.ReactNode;
}

interface GraphNGState {
  data: AlignedData;
  alignedDataFrame: DataFrame;
  dimFields: XYFieldMatchers;
  seriesToDataFrameFieldIndexMap: DataFrameFieldIndex[];
  config?: UPlotConfigBuilder;
}

class UnthemedGraphNG extends React.Component<GraphNGProps, GraphNGState> {
  constructor(props: GraphNGProps) {
    super(props);
    let dimFields = props.fields;

    if (!dimFields) {
      dimFields = {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
      };
    }
    this.state = { dimFields } as GraphNGState;
  }

  /**
   * Since no matter the nature of the change (data vs config only) we always calculate the plot-ready AlignedData array.
   * It's cheaper than run prev and current AlignedData comparison to indicate necessity of data-only update. We assume
   * that if there were no config updates, we can do data only updates(as described in Plot.tsx, L32)
   *
   * Preparing the uPlot-ready data in getDerivedStateFromProps makes the data updates happen only once for a render cycle.
   * If we did it in componendDidUpdate we will end up having two data-only updates: 1) for props and 2) for state update
   *
   * This is a way of optimizing the uPlot rendering, yet there are consequences: when there is a config update,
   * the data is updated first, and then the uPlot is re-initialized. But since the config updates does not happen that
   * often (apart from the edit mode interactions) this should be a fair performance compromise.
   */
  static getDerivedStateFromProps(props: GraphNGProps, state: GraphNGState) {
    let dimFields = props.fields;

    if (!dimFields) {
      dimFields = {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
      };
    }

    const frame = preparePlotFrame(props.data, dimFields);

    if (!frame) {
      return { ...state, dimFields };
    }

    return {
      ...state,
      data: preparePlotData(frame),
      alignedDataFrame: frame,
      seriesToDataFrameFieldIndexMap: frame.fields.map((f) => f.state!.origin!),
      dimFields,
    };
  }

  componentDidMount() {
    const { theme } = this.props;

    // alignedDataFrame is already prepared by getDerivedStateFromProps method
    const { alignedDataFrame } = this.state;

    if (!alignedDataFrame) {
      return;
    }

    this.setState({
      config: preparePlotConfigBuilder(alignedDataFrame, theme, this.getTimeRange, this.getTimeZone),
    });
  }

  componentDidUpdate(prevProps: GraphNGProps) {
    const { data, theme } = this.props;
    const { alignedDataFrame } = this.state;
    let shouldConfigUpdate = false;
    let stateUpdate = {} as GraphNGState;

    if (this.state.config === undefined || this.props.timeZone !== prevProps.timeZone) {
      shouldConfigUpdate = true;
    }

    if (data !== prevProps.data) {
      if (!alignedDataFrame) {
        return;
      }

      const hasStructureChanged = !compareArrayValues(data, prevProps.data, compareDataFrameStructures);

      if (shouldConfigUpdate || hasStructureChanged) {
        const builder = preparePlotConfigBuilder(alignedDataFrame, theme, this.getTimeRange, this.getTimeZone);
        stateUpdate = { ...stateUpdate, config: builder };
      }
    }

    if (Object.keys(stateUpdate).length > 0) {
      this.setState(stateUpdate);
    }
  }

  mapSeriesIndexToDataFrameFieldIndex = (i: number) => {
    return this.state.seriesToDataFrameFieldIndexMap[i];
  };

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
        data={data}
        config={config}
        onSeriesColorChange={onSeriesColorChange}
        onLegendClick={onLegendClick}
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
      <GraphNGContext.Provider
        value={{
          mapSeriesIndexToDataFrameFieldIndex: this.mapSeriesIndexToDataFrameFieldIndex,
          dimFields: this.state.dimFields,
        }}
      >
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
      </GraphNGContext.Provider>
    );
  }
}

export const GraphNG = withTheme(UnthemedGraphNG);
GraphNG.displayName = 'GraphNG';
