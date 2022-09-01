import React, { Component } from 'react';
import { Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import uPlot, { AlignedData } from 'uplot';

import {
  DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  Field,
  FieldMatcherID,
  fieldMatchers,
  LegacyGraphHoverEvent,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { VizLegendOptions } from '@grafana/schema';

import { Themeable2 } from '../../types';
import { PanelContext, PanelContextRoot } from '../PanelChrome/PanelContext';
import { VizLayout } from '../VizLayout/VizLayout';
import { UPlotChart } from '../uPlot/Plot';
import { AxisProps } from '../uPlot/config/UPlotAxisBuilder';
import { Renderers, UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { ScaleProps } from '../uPlot/config/UPlotScaleBuilder';
import { findMidPointYPosition, pluginLog } from '../uPlot/utils';

import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { preparePlotFrame as defaultPreparePlotFrame } from './utils';

/**
 * @internal -- not a public API
 */
export const FIXED_UNIT = '__fixed';

/**
 * @internal -- not a public API
 */
export type PropDiffFn<T extends any = any> = (prev: T, next: T) => boolean;

export interface GraphNGProps extends Themeable2 {
  frames: DataFrame[];
  structureRev?: number; // a number that will change when the frames[] structure changes
  width: number;
  height: number;
  timeRange: TimeRange;
  timeZone: TimeZone[] | TimeZone;
  legend: VizLegendOptions;
  fields?: XYFieldMatchers; // default will assume timeseries data
  renderers?: Renderers;
  tweakScale?: (opts: ScaleProps, forField: Field) => ScaleProps;
  tweakAxis?: (opts: AxisProps, forField: Field) => AxisProps;
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  children?: (builder: UPlotConfigBuilder, alignedFrame: DataFrame) => React.ReactNode;
  prepConfig: (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => UPlotConfigBuilder;
  propsToDiff?: Array<string | PropDiffFn>;
  preparePlotFrame?: (frames: DataFrame[], dimFields: XYFieldMatchers) => DataFrame;
  renderLegend: (config: UPlotConfigBuilder) => React.ReactElement | null;

  /**
   * needed for propsToDiff to re-init the plot & config
   * this is a generic approach to plot re-init, without having to specify which panel-level options
   * should cause invalidation. we can drop this in favor of something like panelOptionsRev that gets passed in
   * similar to structureRev. then we can drop propsToDiff entirely.
   */
  options?: Record<string, any>;
}

function sameProps(prevProps: any, nextProps: any, propsToDiff: Array<string | PropDiffFn> = []) {
  for (const propName of propsToDiff) {
    if (typeof propName === 'function') {
      if (!propName(prevProps, nextProps)) {
        return false;
      }
    } else if (nextProps[propName] !== prevProps[propName]) {
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
  alignedData?: AlignedData;
  config?: UPlotConfigBuilder;
}

/**
 * "Time as X" core component, expects ascending x
 */
export class GraphNG extends Component<GraphNGProps, GraphNGState> {
  static contextType = PanelContextRoot;
  panelContext: PanelContext = {} as PanelContext;
  private plotInstance: React.RefObject<uPlot>;

  private subscription = new Subscription();

  constructor(props: GraphNGProps) {
    super(props);
    let state = this.prepState(props);
    state.alignedData = state.config!.prepData!([state.alignedFrame]) as AlignedData;
    this.state = state;
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
      },
      props.timeRange
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
        config,
      };

      pluginLog('GraphNG', false, 'data prepared', state.alignedData);
    }

    return state;
  }

  handleCursorUpdate(evt: DataHoverEvent | LegacyGraphHoverEvent) {
    const time = evt.payload?.point?.time;
    const u = this.plotInstance.current;
    if (u && time) {
      // Try finding left position on time axis
      const left = u.valToPos(time, 'x');
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
  }

  componentDidMount() {
    this.panelContext = this.context as PanelContext;
    const { eventBus } = this.panelContext;

    this.subscription.add(
      eventBus
        .getStream(DataHoverEvent)
        .pipe(throttleTime(50))
        .subscribe({
          next: (evt) => {
            if (eventBus === evt.origin) {
              return;
            }
            this.handleCursorUpdate(evt);
          },
        })
    );

    // Legacy events (from flot graph)
    this.subscription.add(
      eventBus
        .getStream(LegacyGraphHoverEvent)
        .pipe(throttleTime(50))
        .subscribe({
          next: (evt) => this.handleCursorUpdate(evt),
        })
    );

    this.subscription.add(
      eventBus
        .getStream(DataHoverClearEvent)
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

    if (frames !== prevProps.frames || propsChanged || timeZone !== prevProps.timeZone) {
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
          pluginLog('GraphNG', false, 'config recreated', newState.config);
        }

        newState.alignedData = newState.config!.prepData!([newState.alignedFrame]) as AlignedData;

        this.setState(newState);
      }
    }
  }

  componentWillUnmount() {
    this.subscription.unsubscribe();
  }

  render() {
    const { width, height, children, timeRange, renderLegend } = this.props;
    const { config, alignedFrame, alignedData } = this.state;

    if (!config) {
      return null;
    }

    return (
      <VizLayout width={width} height={height} legend={renderLegend(config)}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            config={config}
            data={alignedData!}
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
