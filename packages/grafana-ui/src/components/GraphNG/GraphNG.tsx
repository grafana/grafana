import React from 'react';
import { AlignedData } from 'uplot';
import { DataFrame, FieldMatcherID, fieldMatchers, FieldType, TimeRange, TimeZone } from '@grafana/data';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { pluginLog, preparePlotData } from '../uPlot/utils';
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
  frames: DataFrame[];
  structureRev?: number; // a number that will change when the data[] structure changes
  timeRange: TimeRange;
  timeZone: TimeZone;
  legend: VizLegendOptions;
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
  children?: (builder: UPlotConfigBuilder, alignedFrame: DataFrame) => React.ReactNode;
}

/**
 * @internal -- not a public API
 */
export interface GraphNGState {
  alignedFrame: DataFrame;
  alignedData: AlignedData;
  config?: UPlotConfigBuilder;
}

class UnthemedGraphNG extends React.Component<GraphNGProps, GraphNGState> {
  constructor(props: GraphNGProps) {
    super(props);
    this.state = this.prepState(props);
  }

  getTimeRange = () => this.props.timeRange;

  prepState(props: GraphNGProps, withConfig = true) {
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
        state.config = preparePlotConfigBuilder(alignedFrame, theme, timeZone, this.getTimeRange);
      }
    }

    return state;
  }

  componentDidUpdate(prevProps: GraphNGProps) {
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
          !structureRev;

        if (shouldReconfig) {
          //console.log("shouldReconfig");

          newState.config = preparePlotConfigBuilder(newState.alignedFrame, theme, timeZone, this.getTimeRange);
        }
      }

      newState && this.setState(newState);
    }
  }

  renderLegend() {
    const { legend, onSeriesColorChange, onLegendClick, frames } = this.props;
    const { config } = this.state;

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
}

export const GraphNG = withTheme(UnthemedGraphNG);
GraphNG.displayName = 'GraphNG';
