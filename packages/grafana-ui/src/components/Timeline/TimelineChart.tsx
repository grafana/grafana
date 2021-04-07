import React from 'react';
import { compareArrayValues, compareDataFrameStructures, FieldMatcherID, fieldMatchers } from '@grafana/data';
import { withTheme } from '../../themes';
import { GraphNGContext } from '../GraphNG/hooks';
import { GraphNGState } from '../GraphNG/GraphNG';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils'; // << preparePlotConfigBuilder is really the only change vs GraphNG
import { preparePlotData } from '../uPlot/utils';
import { PlotLegend } from '../uPlot/PlotLegend';
import { UPlotChart } from '../uPlot/Plot';
import { LegendDisplayMode } from '../VizLegend/types';
import { VizLayout } from '../VizLayout/VizLayout';
import { TimelineProps } from './types';

class UnthemedTimelineChart extends React.Component<TimelineProps, GraphNGState> {
  constructor(props: TimelineProps) {
    super(props);
    let dimFields = props.fields;

    if (!dimFields) {
      dimFields = {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}), // this may be either numeric or strings, (or bools?)
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
  static getDerivedStateFromProps(props: TimelineProps, state: GraphNGState) {
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
    const { theme, mode, rowHeight, colWidth, showValue } = this.props;

    // alignedDataFrame is already prepared by getDerivedStateFromProps method
    const { alignedDataFrame } = this.state;

    if (!alignedDataFrame) {
      return;
    }

    this.setState({
      config: preparePlotConfigBuilder(alignedDataFrame, theme, this.getTimeRange, this.getTimeZone, {
        mode,
        rowHeight,
        colWidth,
        showValue,
      }),
    });
  }

  componentDidUpdate(prevProps: TimelineProps) {
    const { data, theme, timeZone, mode, rowHeight, colWidth, showValue } = this.props;
    const { alignedDataFrame } = this.state;
    let shouldConfigUpdate = false;
    let stateUpdate = {} as GraphNGState;

    if (
      this.state.config === undefined ||
      timeZone !== prevProps.timeZone ||
      mode !== prevProps.mode ||
      rowHeight !== prevProps.rowHeight ||
      colWidth !== prevProps.colWidth ||
      showValue !== prevProps.showValue
    ) {
      shouldConfigUpdate = true;
    }

    if (data !== prevProps.data) {
      if (!alignedDataFrame) {
        return;
      }

      if (!compareArrayValues(data, prevProps.data, compareDataFrameStructures)) {
        shouldConfigUpdate = true;
      }
    }

    if (shouldConfigUpdate) {
      const builder = preparePlotConfigBuilder(alignedDataFrame, theme, this.getTimeRange, this.getTimeZone, {
        mode,
        rowHeight,
        colWidth,
        showValue,
      });
      stateUpdate = { ...stateUpdate, config: builder };
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
      <GraphNGContext.Provider
        value={{
          mapSeriesIndexToDataFrameFieldIndex: this.mapSeriesIndexToDataFrameFieldIndex,
          dimFields: this.state.dimFields,
          data: this.state.alignedDataFrame,
        }}
      >
        <VizLayout width={width} height={height}>
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

export const TimelineChart = withTheme(UnthemedTimelineChart);
TimelineChart.displayName = 'TimelineChart';
