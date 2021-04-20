import React from 'react';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { withTheme } from '../../themes';
import { GraphNGContext } from '../GraphNG/hooks';
import { GraphNGState } from '../GraphNG/GraphNG';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils'; // << preparePlotConfigBuilder is really the only change vs GraphNG
import { preparePlotData } from '../uPlot/utils';
import { PlotLegend } from '../uPlot/PlotLegend';
import { UPlotChart } from '../uPlot/Plot';
import { LegendDisplayMode } from '../VizLegend/models.gen';
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

    const alignedDataFrame = preparePlotFrame(props.data, dimFields);
    const data = alignedDataFrame && preparePlotData(alignedDataFrame);

    this.state = {
      dimFields,
      alignedDataFrame,
      data,
      seriesToDataFrameFieldIndexMap: alignedDataFrame?.fields.map((f) => f.state!.origin!),
      config:
        alignedDataFrame &&
        preparePlotConfigBuilder(alignedDataFrame, props.theme, this.getTimeRange, this.getTimeZone, {
          mode: props.mode,
          rowHeight: props.rowHeight,
          colWidth: props.colWidth,
          showValue: props.showValue,
        }),
    };
  }

  componentDidUpdate(prevProps: TimelineProps) {
    const { data, theme, timeZone, mode, rowHeight, colWidth, showValue, structureRev, resultRev } = this.props;
    let shouldConfigUpdate = false;
    let stateUpdate = {} as GraphNGState;
    let builder;

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
    const hasStructureChanged = structureRev !== prevProps.structureRev;
    const alignedDataFrame = preparePlotFrame(data, this.props.fields || this.state.dimFields);
    const plotData = alignedDataFrame && preparePlotData(alignedDataFrame);

    if (shouldConfigUpdate || hasStructureChanged) {
      builder = preparePlotConfigBuilder(
        // use either a newly aligned data if data changed, or reuse previous one
        alignedDataFrame || this.state.alignedDataFrame!,
        theme,
        this.getTimeRange,
        this.getTimeZone,
        { mode, rowHeight, colWidth, showValue }
      );
      if (shouldConfigUpdate || hasStructureChanged) {
        stateUpdate = { ...stateUpdate, config: builder };
      }
    }

    if (data !== prevProps.data) {
      let shouldDataUpdate =
        resultRev !== prevProps.resultRev || !alignedDataFrame || prevProps.fields !== this.props.fields;

      if (shouldDataUpdate) {
        if (plotData) {
          stateUpdate = {
            ...stateUpdate,
            alignedDataFrame,
            data: plotData,
          };
        }
      }
    } else {
      if (builder) {
        stateUpdate = { ...stateUpdate, config: builder };
      }
    }

    if (Object.keys(stateUpdate).length > 0) {
      this.setState(stateUpdate);
    }
  }

  mapSeriesIndexToDataFrameFieldIndex = (i: number) => {
    return this.state.seriesToDataFrameFieldIndexMap![i];
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

    if (!this.state.data || !this.state.config || !this.state.alignedDataFrame) {
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
              data={this.state.data!}
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
