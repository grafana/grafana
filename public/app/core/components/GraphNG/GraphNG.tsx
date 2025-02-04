import { Component } from 'react';
import * as React from 'react';
import uPlot, { AlignedData } from 'uplot';

import {
  DataFrame,
  DataLinkPostProcessor,
  Field,
  FieldMatcherID,
  fieldMatchers,
  FieldType,
  getLinksSupplier,
  InterpolateFunction,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { DashboardCursorSync, VizLegendOptions } from '@grafana/schema';
import { Themeable2, VizLayout } from '@grafana/ui';
import { UPlotChart } from '@grafana/ui/src/components/uPlot/Plot';
import { AxisProps } from '@grafana/ui/src/components/uPlot/config/UPlotAxisBuilder';
import { Renderers, UPlotConfigBuilder } from '@grafana/ui/src/components/uPlot/config/UPlotConfigBuilder';
import { ScaleProps } from '@grafana/ui/src/components/uPlot/config/UPlotScaleBuilder';
import { pluginLog } from '@grafana/ui/src/components/uPlot/utils';

import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { preparePlotFrame as defaultPreparePlotFrame } from './utils';

/**
 * @internal -- not a public API
 */
export type PropDiffFn<T extends Record<string, unknown> = {}> = (prev: T, next: T) => boolean;

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
  preparePlotFrame?: (frames: DataFrame[], dimFields: XYFieldMatchers) => DataFrame | null;
  renderLegend: (config: UPlotConfigBuilder) => React.ReactElement | null;
  replaceVariables: InterpolateFunction;
  dataLinkPostProcessor?: DataLinkPostProcessor;
  cursorSync?: DashboardCursorSync;

  // Remove fields that are hidden from the visualization before rendering
  // The fields will still be available for other things like data links
  // this is a temporary hack that only works when:
  // 1. renderLegend (above) does not render <PlotLegend>
  // 2. does not have legend series toggle
  // 3. passes through all fields required for link/action gen (including those with hideFrom.viz)
  omitHideFromViz?: boolean;

  /**
   * needed for propsToDiff to re-init the plot & config
   * this is a generic approach to plot re-init, without having to specify which panel-level options
   * should cause invalidation. we can drop this in favor of something like panelOptionsRev that gets passed in
   * similar to structureRev. then we can drop propsToDiff entirely.
   */
  options?: Record<string, any>;
}

function sameProps<T extends Record<string, unknown>>(
  prevProps: T,
  nextProps: T,
  propsToDiff: Array<string | PropDiffFn> = []
) {
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

const defaultMatchers = {
  x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
  y: fieldMatchers.get(FieldMatcherID.byTypes).get(new Set([FieldType.number, FieldType.enum])),
};

/**
 * "Time as X" core component, expects ascending x
 */
export class GraphNG extends Component<GraphNGProps, GraphNGState> {
  private plotInstance: React.RefObject<uPlot>;

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

    const { frames, fields = defaultMatchers, preparePlotFrame, replaceVariables, dataLinkPostProcessor } = props;

    const preparePlotFrameFn = preparePlotFrame ?? defaultPreparePlotFrame;

    const withLinks = frames.some((frame) => frame.fields.some((field) => (field.config.links?.length ?? 0) > 0));

    const alignedFrame = preparePlotFrameFn(
      frames,
      {
        ...fields,
        // if there are data links, keep all fields during join so they're index-matched
        y: withLinks ? () => true : fields.y,
      },
      props.timeRange
    );

    pluginLog('GraphNG', false, 'data aligned', alignedFrame);

    if (alignedFrame) {
      let alignedFrameFinal = alignedFrame;

      if (withLinks) {
        const timeZone = Array.isArray(this.props.timeZone) ? this.props.timeZone[0] : this.props.timeZone;

        // for links gen we need to use original frames but with the aligned/joined data values
        let linkFrames = frames.map((frame, frameIdx) => ({
          ...frame,
          fields: alignedFrame.fields.filter(
            (field, fieldIdx) => fieldIdx === 0 || field.state?.origin?.frameIndex === frameIdx
          ),
          length: alignedFrame.length,
        }));

        linkFrames.forEach((linkFrame, frameIndex) => {
          linkFrame.fields.forEach((field) => {
            field.getLinks = getLinksSupplier(
              linkFrame,
              field,
              {
                ...field.state?.scopedVars,
                __dataContext: {
                  value: {
                    data: linkFrames,
                    field: field,
                    frame: linkFrame,
                    frameIndex,
                  },
                },
              },
              replaceVariables,
              timeZone,
              dataLinkPostProcessor
            );
          });
        });

        // filter join field and fields.y
        alignedFrameFinal = {
          ...alignedFrame,
          fields: alignedFrame.fields.filter((field, i) => i === 0 || fields.y(field, alignedFrame, [alignedFrame])),
        };
      }

      if (props.omitHideFromViz) {
        const nonHiddenFields = alignedFrameFinal.fields.filter((field) => field.config.custom?.hideFrom?.viz !== true);
        alignedFrameFinal = {
          ...alignedFrameFinal,
          fields: nonHiddenFields,
          length: nonHiddenFields.length,
        };
      }

      let config = this.state?.config;

      if (withConfig) {
        config = props.prepConfig(alignedFrameFinal, this.props.frames, this.getTimeRange);
        pluginLog('GraphNG', false, 'config prepared', config);
      }

      state = {
        alignedFrame: alignedFrameFinal,
        config,
      };

      pluginLog('GraphNG', false, 'data prepared', state.alignedData);
    }

    return state;
  }

  componentDidUpdate(prevProps: GraphNGProps) {
    const { frames, structureRev, timeZone, cursorSync, propsToDiff } = this.props;

    const propsChanged = !sameProps(prevProps, this.props, propsToDiff);

    if (
      frames !== prevProps.frames ||
      propsChanged ||
      timeZone !== prevProps.timeZone ||
      cursorSync !== prevProps.cursorSync
    ) {
      let newState = this.prepState(this.props, false);

      if (newState) {
        const shouldReconfig =
          this.state.config === undefined ||
          timeZone !== prevProps.timeZone ||
          cursorSync !== prevProps.cursorSync ||
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

  render() {
    const { width, height, children, renderLegend } = this.props;
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
            plotRef={(u) => ((this.plotInstance as React.MutableRefObject<uPlot>).current = u)}
          >
            {children ? children(config, alignedFrame) : null}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}
