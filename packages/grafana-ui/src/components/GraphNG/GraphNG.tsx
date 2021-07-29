import React from 'react';
import { AlignedData } from 'uplot';
import { Themeable2 } from '../../types';
import { findMidPointYPosition, pluginLog } from '../uPlot/utils';
import {
  DataFrame,
  FieldMatcherID,
  fieldMatchers,
  LegacyGraphHoverClearEvent,
  LegacyGraphHoverEvent,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { preparePlotFrame as defaultPreparePlotFrame } from './utils';

import { VizLegendOptions } from '../VizLegend/models.gen';
import { PanelContext, PanelContextRoot } from '../PanelChrome/PanelContext';
import { Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { VizLayout } from '../VizLayout/VizLayout';
import { UPlotChart } from '../uPlot/Plot';

/**
 * @internal -- not a public API
 */
export const FIXED_UNIT = '__fixed';

export interface GraphNGProps extends Themeable2 {
  frames: DataFrame[];
  structureRev?: number; // a number that will change when the frames[] structure changes
  width: number;
  height: number;
  timeRange: TimeRange;
  timeZone: TimeZone;
  legend: VizLegendOptions;
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  children?: (builder: UPlotConfigBuilder, alignedFrame: DataFrame) => React.ReactNode;
  prepConfig: (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => UPlotConfigBuilder;
  propsToDiff?: string[];
  preparePlotFrame?: (frames: DataFrame[], dimFields: XYFieldMatchers) => DataFrame;
  renderLegend: (config: UPlotConfigBuilder) => React.ReactElement | null;
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
  static contextType = PanelContextRoot;
  panelContext: PanelContext = {} as PanelContext;
  private plotInstance: React.RefObject<uPlot>;

  private subscription = new Subscription();

  constructor(props: GraphNGProps) {
    super(props);
    this.state = this.prepState(props);
    this.plotInstance = React.createRef();
  }

  getTimeRange = () => this.props.timeRange;

  prepState(props: GraphNGProps, withConfig = true) {
    let state: GraphNGState = null as any;

    const { frames, fields, preparePlotFrame } = props;

    const preparePlotFrameFn = preparePlotFrame || defaultPreparePlotFrame;

    const alignedFrame = preparePlotFrameFn(
      frames,
      fields || {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
      }
    );
    pluginLog('GraphNG', false, 'data aligned', alignedFrame);

    if (alignedFrame) {
      let config = this.state?.config;

      if (withConfig) {
        config = props.prepConfig(alignedFrame, this.props.frames, this.getTimeRange);
        pluginLog('GraphNG', false, 'config prepared', config);
      }

      state = {
        alignedFrame,
        alignedData: config!.prepData!(alignedFrame),
        config,
      };

      pluginLog('GraphNG', false, 'data prepared', state.alignedData);
    }

    return state;
  }

  componentDidMount() {
    this.panelContext = this.context as PanelContext;
    const { eventBus } = this.panelContext;

    this.subscription.add(
      eventBus
        .getStream(LegacyGraphHoverEvent)
        .pipe(throttleTime(50))
        .subscribe({
          next: (evt) => {
            const u = this.plotInstance.current;
            if (u) {
              // Try finding left position on time axis
              const left = u.valToPos(evt.payload.point.time, 'time');
              let top;
              if (left) {
                // find midpoint between points at current idx
                top = findMidPointYPosition(u, u.posToIdx(left));
              }

              if (!top || !left) {
                return;
              }

              u.setCursor({
                left,
                top,
              });
            }
          },
        })
    );

    this.subscription.add(
      eventBus
        .getStream(LegacyGraphHoverClearEvent)
        .pipe(throttleTime(50))
        .subscribe({
          next: () => {
            const u = this.plotInstance?.current;

            if (u) {
              u.setCursor({
                left: -10,
                top: -10,
              });
            }
          },
        })
    );
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
          newState.config = this.props.prepConfig(newState.alignedFrame, this.props.frames, this.getTimeRange);
          newState.alignedData = newState.config.prepData!(newState.alignedFrame);
          pluginLog('GraphNG', false, 'config recreated', newState.config);
        }
      }

      newState && this.setState(newState);
    }
  }

  componentWillUnmount() {
    this.subscription.unsubscribe();
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
            plotRef={(u) => ((this.plotInstance as React.MutableRefObject<uPlot>).current = u)}
          >
            {children ? children(config, alignedFrame) : null}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}
