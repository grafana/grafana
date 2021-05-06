import React from 'react';
import { AlignedData } from 'uplot';
import { DataFrame, FieldMatcherID, fieldMatchers, FieldType, TimeRange, TimeZone } from '@grafana/data';
import { Themeable2 } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { preparePlotFrame } from './utils';
import { preparePlotData } from '../uPlot/utils';
import { UPlotChart } from '../uPlot/Plot';
import { VizLegendOptions } from '../VizLegend/models.gen';
import { VizLayout } from '../VizLayout/VizLayout';

/**
 * @internal -- not a public API
 */
export const FIXED_UNIT = '__fixed';

export interface GraphNGProps extends Themeable2 {
  width: number;
  height: number;
  frames: DataFrame[];
  structureRev?: number; // a number that will change when the frames[] structure changes
  timeRange: TimeRange;
  timeZone: TimeZone;
  legend: VizLegendOptions;
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  children?: (builder: UPlotConfigBuilder, alignedFrame: DataFrame) => React.ReactNode;

  prepConfig: (alignedFrame: DataFrame, getTimeRange: () => TimeRange) => UPlotConfigBuilder;
  propsToDiff?: string[];
  renderLegend: (config: UPlotConfigBuilder) => React.ReactElement;
}

function sameProps(prevProps: any, nextProps: any, propsToDiff: string[] = []) {
  for (const propName of propsToDiff) {
    if (nextProps[propName] !== prevProps[propName]) {
      return false;
    }
  }

  return true;
}

/**
 * @internal -- not a public API
 */
export interface GraphNGState {
  alignedFrame: DataFrame;
  alignedData: AlignedData;
  config?: UPlotConfigBuilder;
}

/**
 * "Time as X" core component, expectes ascending x
 */
export class GraphNG extends React.Component<GraphNGProps, GraphNGState> {
  constructor(props: GraphNGProps) {
    super(props);
    this.state = this.prepState(props);
  }

  getTimeRange = () => this.props.timeRange;

  prepState(props: GraphNGProps, withConfig = true) {
    let state: GraphNGState = null as any;

    const { frames, fields } = props;

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
        state.config = props.prepConfig(alignedFrame, this.getTimeRange);
      }
    }

    return state;
  }

  componentDidUpdate(prevProps: GraphNGProps) {
    const { frames, structureRev, timeZone, propsToDiff } = this.props;

    const propsChanged = !sameProps(prevProps, this.props, propsToDiff);

    if (frames !== prevProps.frames || propsChanged) {
      let newState = this.prepState(this.props, false);

      if (newState) {
        const shouldReconfig =
          this.state.config === undefined ||
          timeZone !== prevProps.timeZone ||
          structureRev !== prevProps.structureRev ||
          !structureRev ||
          propsChanged;

        if (shouldReconfig) {
          newState.config = this.props.prepConfig(newState.alignedFrame, this.getTimeRange);
        }
      }

      newState && this.setState(newState);
    }
  }

  render() {
    const { width, height, children, timeRange, renderLegend } = this.props;
    const { config, alignedFrame } = this.state;

    if (!config) {
      return null;
    }

    return (
      <VizLayout width={width} height={height} legend={renderLegend(config)}>
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
