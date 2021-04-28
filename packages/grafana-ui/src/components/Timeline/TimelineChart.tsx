import React from 'react';
import { FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { withTheme } from '../../themes';
import { GraphNGState } from '../GraphNG/GraphNG';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils'; // << preparePlotConfigBuilder is really the only change vs GraphNG
import { preparePlotData } from '../uPlot/utils';
import { UPlotChart } from '../uPlot/Plot';
import { VizLayout } from '../VizLayout/VizLayout';
import { TimelineProps } from './types';

class UnthemedTimelineChart extends React.Component<TimelineProps, GraphNGState> {
  constructor(props: TimelineProps) {
    super(props);
    this.state = this.prepState(props);
  }

  getTimeRange = () => this.props.timeRange;

  prepState(props: TimelineProps, withConfig = true) {
    let state: GraphNGState = null as any;

    const { frames, fields, timeZone, theme } = props;

    const alignedFrame = preparePlotFrame(
      frames,
      fields || {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
      }
    );

    if (alignedFrame) {
      state = {
        alignedFrame,
        alignedData: preparePlotData(alignedFrame, [FieldType.number]),
      };

      if (withConfig) {
        state.config = preparePlotConfigBuilder(
          alignedFrame,
          theme,
          timeZone,
          this.getTimeRange,
          this.addlProps(props)
        );
      }
    }

    return state;
  }

  componentDidUpdate(prevProps: TimelineProps) {
    const { frames, structureRev, timeZone, theme } = this.props;

    if (frames !== prevProps.frames) {
      //console.log("frames !== prevProps.frames");

      let newState = this.prepState(this.props, false);

      if (newState) {
        //console.log("newState");

        const shouldReconfig =
          this.state.config === undefined ||
          timeZone !== prevProps.timeZone ||
          structureRev !== prevProps.structureRev ||
          !structureRev ||
          this.shouldReconfig(prevProps, this.props);

        if (shouldReconfig) {
          //console.log("shouldReconfig");

          newState.config = preparePlotConfigBuilder(
            newState.alignedFrame,
            theme,
            timeZone,
            this.getTimeRange,
            this.addlProps(this.props)
          );
        }
      }

      newState && this.setState(newState);
    }
  }

  render() {
    const { width, height, children, timeRange } = this.props;
    const { config, alignedFrame } = this.state;

    if (!config) {
      return null;
    }

    return (
      <VizLayout width={width} height={height} legend={this.renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            config={this.state.config!}
            data={this.state.alignedData}
            width={vizWidth}
            height={vizHeight}
            timeRange={timeRange}
          >
            {children ? children(config, alignedFrame) : null}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }

  shouldReconfig(prevProps: TimelineProps, props: TimelineProps) {
    const { mode, rowHeight, colWidth, showValue } = props;

    return (
      mode !== prevProps.mode ||
      rowHeight !== prevProps.rowHeight ||
      colWidth !== prevProps.colWidth ||
      showValue !== prevProps.showValue
    );
  }

  addlProps(props: TimelineProps) {
    const { mode, rowHeight, colWidth, showValue } = props;

    return {
      mode,
      rowHeight,
      colWidth,
      showValue,
    };
  }

  renderLegend() {
    return undefined;
  }
}

export const TimelineChart = withTheme(UnthemedTimelineChart);
TimelineChart.displayName = 'TimelineChart';
