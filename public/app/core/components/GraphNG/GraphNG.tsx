import * as React from 'react';
import { useRef, useState } from 'react';

import {
  type DataFrame,
  type DataLinkPostProcessor,
  type Field,
  FieldMatcherID,
  fieldMatchers,
  FieldType,
  getLinksSupplier,
  type InterpolateFunction,
  type TimeRange,
  type TimeZone,
} from '@grafana/data';
import { type DashboardCursorSync, type VizLegendOptions } from '@grafana/schema';
import { useTheme2, VizLayout, type VizLayoutLegendProps } from '@grafana/ui';
import {
  type AxisProps,
  getStackingGroups,
  pluginLog,
  type Renderers,
  type ScaleProps,
  type StackingGroup,
  UPlotChart,
  type UPlotConfigBuilder,
} from '@grafana/ui/internal';

import { type GraphNGLegendEvent, type XYFieldMatchers } from './types';
import { preparePlotFrame as defaultPreparePlotFrame } from './utils';

/**
 * @internal -- not a public API
 */
export type PropDiffFn<T extends Record<string, unknown> = {}> = (prev: T, next: T) => boolean;

export type GraphNGProps = {
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
  prepConfig: (
    alignedFrame: DataFrame,
    allFrames: DataFrame[],
    getTimeRange: () => TimeRange,
    annotationLanes?: number
  ) => UPlotConfigBuilder;
  propsToDiff?: Array<string | PropDiffFn>;
  preparePlotFrame?: (frames: DataFrame[], dimFields: XYFieldMatchers) => DataFrame | null;
  renderLegend: (config: UPlotConfigBuilder) => React.ReactElement<VizLayoutLegendProps> | null;
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

  // Annotation lanes count
  annotationLanes?: number;
};

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

function sameStackingGroups(prevGroups: StackingGroup[], nextGroups: StackingGroup[]) {
  return (
    prevGroups.length === nextGroups.length &&
    prevGroups.every((prev, i) => {
      const next = nextGroups[i];
      return (
        prev.dir === next.dir &&
        prev.series.length === next.series.length &&
        prev.series.every((seriesIdx, j) => seriesIdx === next.series[j])
      );
    })
  );
}

const defaultMatchers = {
  x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
  y: fieldMatchers.get(FieldMatcherID.byTypes).get(new Set([FieldType.number, FieldType.enum])),
};

function prepAlignedFrame(props: Readonly<GraphNGProps>) {
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

  if (!alignedFrame) {
    return null;
  }

  let alignedFrameFinal = alignedFrame;

  if (withLinks) {
    const timeZone = Array.isArray(props.timeZone) ? props.timeZone[0] : props.timeZone;

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

  return alignedFrameFinal;
}

/**
 * "Time as X" core component, expects ascending x
 */
export function GraphNG(props: GraphNGProps) {
  const { frames, structureRev, timeZone, cursorSync, propsToDiff, width, height, children, renderLegend } = props;

  // the config builders call getTimeRange from UPlotChart's layout effects (via setData), which run before any
  // effect here, so the ref has to be current by the end of render (as this.props was in the class version)
  const timeRangeRef = useRef(props.timeRange);
  // eslint-disable-next-line react-hooks/refs
  timeRangeRef.current = props.timeRange;
  const [getTimeRange] = useState(() => () => timeRangeRef.current);

  const [alignedFrame, setAlignedFrame] = useState(() => prepAlignedFrame(props)!);
  const [config, setConfig] = useState(() => {
    const initialConfig = props.prepConfig(alignedFrame, frames, getTimeRange, props.annotationLanes);
    pluginLog('GraphNG', false, 'config prepared', initialConfig);
    return initialConfig;
  });
  const [alignedData, setAlignedData] = useState(() => config.prepData!([alignedFrame]));

  const [prevProps, setPrevProps] = useState(props);
  const theme = useTheme2();
  const [prevTheme, setPrevTheme] = useState(theme);
  const propsChanged = !sameProps(prevProps, props, propsToDiff);

  if (
    frames !== prevProps.frames ||
    propsChanged ||
    timeZone !== prevProps.timeZone ||
    cursorSync !== prevProps.cursorSync ||
    theme !== prevTheme
  ) {
    setPrevProps(props);
    setPrevTheme(theme);
    const nextAlignedFrame = prepAlignedFrame(props);

    if (nextAlignedFrame) {
      // stack direction is inferred from the values, so it can flip without a structure change
      const prevStackingGroups = config.getStackingGroups();
      const stackingChanged =
        prevStackingGroups.length > 0 &&
        !sameStackingGroups(prevStackingGroups, getStackingGroups(nextAlignedFrame, prevStackingGroups));

      const shouldReconfig =
        timeZone !== prevProps.timeZone ||
        cursorSync !== prevProps.cursorSync ||
        theme !== prevTheme ||
        structureRev !== prevProps.structureRev ||
        !structureRev ||
        propsChanged ||
        stackingChanged;

      let nextConfig = config;

      if (shouldReconfig) {
        nextConfig = props.prepConfig(nextAlignedFrame, frames, getTimeRange, props.annotationLanes);
        pluginLog('GraphNG', false, 'config recreated', nextConfig);
        setConfig(nextConfig);
      }

      setAlignedFrame(nextAlignedFrame);
      setAlignedData(nextConfig.prepData!([nextAlignedFrame]));
    }
  }

  return (
    <VizLayout width={width} height={height} legend={renderLegend(config)}>
      {(vizWidth: number, vizHeight: number) => (
        <UPlotChart config={config} data={alignedData} width={vizWidth} height={vizHeight}>
          {children ? children(config, alignedFrame) : null}
        </UPlotChart>
      )}
    </VizLayout>
  );
}
