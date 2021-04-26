import React from 'react';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { withTheme } from '../../themes';
import { GraphNGState } from '../GraphNG/GraphNG';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils'; // << preparePlotConfigBuilder is really the only change vs GraphNG
import { pluginLog, preparePlotData } from '../uPlot/utils';
import { PlotLegend } from '../uPlot/PlotLegend';
import { UPlotChart } from '../uPlot/Plot';
import { LegendDisplayMode } from '../VizLegend/models.gen';
import { VizLayout } from '../VizLayout/VizLayout';
import { TimelineProps } from './types';

class UnthemedTimelineChart extends React.Component<TimelineProps, GraphNGState> {
  constructor(props: TimelineProps) {
    super(props);
    const { theme, mode, rowHeight, colWidth, showValue } = props;

    pluginLog('TimelineChart', false, 'constructor, data aligment');
    const alignedData = preparePlotFrame(
      props.data,
      props.fields || {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
      }
    );

    if (!alignedData) {
      return;
    }

    this.state = {
      alignedDataFrame: alignedData,
      data: preparePlotData(alignedData),
      config: preparePlotConfigBuilder(alignedData, theme, this.getTimeRange, this.getTimeZone, {
        mode,
        rowHeight,
        colWidth,
        showValue,
      }),
    };
  }

  componentDidUpdate(prevProps: TimelineProps) {
    const { data, theme, timeZone, mode, rowHeight, colWidth, showValue, structureRev } = this.props;
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

    if (data !== prevProps.data || shouldConfigUpdate) {
      const hasStructureChanged = structureRev !== prevProps.structureRev || !structureRev;

      const alignedData = preparePlotFrame(
        data,
        this.props.fields || {
          x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
          y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
        }
      );
      if (!alignedData) {
        return;
      }

      stateUpdate = {
        alignedDataFrame: alignedData,
        data: preparePlotData(alignedData),
      };
      if (shouldConfigUpdate || hasStructureChanged) {
        pluginLog('TimelineChart', false, 'updating config');
        const builder = preparePlotConfigBuilder(alignedData, theme, this.getTimeRange, this.getTimeZone, {
          mode,
          rowHeight,
          colWidth,
          showValue,
        });
        stateUpdate = { ...stateUpdate, config: builder };
      }
    }

    if (Object.keys(stateUpdate).length > 0) {
      this.setState(stateUpdate);
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
    const { width, height, children, timeRange } = this.props;
    const { config, alignedDataFrame } = this.state;

    if (!config) {
      return null;
    }

    return (
      <VizLayout width={width} height={height}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            config={this.state.config!}
            data={this.state.data}
            width={vizWidth}
            height={vizHeight}
            timeRange={timeRange}
          >
            {children ? children(config, alignedDataFrame) : null}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}

export const TimelineChart = withTheme(UnthemedTimelineChart);
TimelineChart.displayName = 'TimelineChart';
