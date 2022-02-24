import React, { useMemo, useRef } from 'react';
import { EventBus, FieldMatcherID, fieldMatchers, PanelProps, TimeRange } from '@grafana/data';
// import { TooltipDisplayMode } from '@grafana/schema';
import {
  // usePanelContext,
  // TimeSeries,
  // TooltipPlugin,
  // ZoomPlugin,
  // KeyboardPlugin,
  UPlotChart2,
  preparePlotFrame,
  useTheme2,
} from '@grafana/ui';
// import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
// import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
// import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
// import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { TimeSeriesOptions } from './types';
import { prepareGraphableFields } from './utils';
// import { AnnotationEditorPlugin } from './plugins/AnnotationEditorPlugin';
// import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { config } from 'app/core/config';
import { PanelDataErrorView } from '@grafana/runtime';
import { preparePlotConfigBuilder } from '@grafana/ui/src/components/TimeSeries/utils';

interface TimeSeriesPanelProps extends PanelProps<TimeSeriesOptions> {}

export const TimeSeriesPanel: React.FC<TimeSeriesPanelProps> = ({
  data,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
  id,
  timeZone,
  ...otherProps
}) => {
  // const { sync, canAddAnnotations, onThresholdsChange, canEditThresholds, onSplitOpen } = usePanelContext();
  const theme = useTheme2();
  const timeRange = useRef<TimeRange>();
  const eventBus = useRef<EventBus>();

  timeRange.current = otherProps.timeRange;
  eventBus.current = otherProps.eventBus;

  // const getFieldLinks = (field: Field, rowIndex: number) => {
  //   return getFieldLinksForExplore({ field, rowIndex, splitOpenFn: onSplitOpen, range: timeRange });
  // };

  const frames = useMemo(() => prepareGraphableFields(data.series, config.theme2), [data]);

  const cfg = useMemo(() => {
    console.log('TimeSeriesPanel.preparePlotConfigBuilder memo');

    const alignedFrame = preparePlotFrame(data.series, {
      x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
      y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
    });

    return preparePlotConfigBuilder({
      allFrames: data.series,
      frame: alignedFrame!,
      timeZone: timeZone,
      eventBus: eventBus.current!,
      theme,
      getTimeRange: () => timeRange.current!,
    });
  }, [data.structureRev, timeZone]);

  const plotData = useMemo(() => {
    if (!cfg) {
      return null;
    }

    return cfg.prepData({
      frames: data.series,
    });
  }, [cfg, data]);

  // const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());

  if (!frames) {
    return <PanelDataErrorView panelId={id} data={data} needsTimeField={true} needsNumberField={true} />;
  }

  if (!plotData || !cfg) {
    return null;
  }
  return (
    <UPlotChart2 config={cfg} data={plotData.aligned} width={width} height={height}></UPlotChart2>
    // <TimeSeries
    //   frames={frames}
    //   structureRev={data.structureRev}
    //   timeRange={timeRange}
    //   timeZone={timeZone}
    //   width={width}
    //   height={height}
    //   legend={options.legend}
    // >
    //   {(config, alignedDataFrame) => {
    //     return (
    //       <>
    //         <KeyboardPlugin config={config} />
    //         <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
    //         {options.tooltip.mode === TooltipDisplayMode.None || (
    //           <TooltipPlugin
    //             data={alignedDataFrame}
    //             config={config}
    //             mode={options.tooltip.mode}
    //             sortOrder={options.tooltip.sort}
    //             sync={sync}
    //             timeZone={timeZone}
    //           />
    //         )}
    //         {/* Renders annotation markers*/}
    //         {data.annotations && (
    //           <AnnotationsPlugin annotations={data.annotations} config={config} timeZone={timeZone} />
    //         )}
    //         {/* Enables annotations creation*/}
    //         {enableAnnotationCreation ? (
    //           <AnnotationEditorPlugin data={alignedDataFrame} timeZone={timeZone} config={config}>
    //             {({ startAnnotating }) => {
    //               return (
    //                 <ContextMenuPlugin
    //                   data={alignedDataFrame}
    //                   config={config}
    //                   timeZone={timeZone}
    //                   replaceVariables={replaceVariables}
    //                   defaultItems={[
    //                     {
    //                       items: [
    //                         {
    //                           label: 'Add annotation',
    //                           ariaLabel: 'Add annotation',
    //                           icon: 'comment-alt',
    //                           onClick: (e, p) => {
    //                             if (!p) {
    //                               return;
    //                             }
    //                             startAnnotating({ coords: p.coords });
    //                           },
    //                         },
    //                       ],
    //                     },
    //                   ]}
    //                 />
    //               );
    //             }}
    //           </AnnotationEditorPlugin>
    //         ) : (
    //           <ContextMenuPlugin
    //             data={alignedDataFrame}
    //             config={config}
    //             timeZone={timeZone}
    //             replaceVariables={replaceVariables}
    //             defaultItems={[]}
    //           />
    //         )}
    //         {data.annotations && (
    //           <ExemplarsPlugin
    //             config={config}
    //             exemplars={data.annotations}
    //             timeZone={timeZone}
    //             getFieldLinks={getFieldLinks}
    //           />
    //         )}

    //         {canEditThresholds && onThresholdsChange && (
    //           <ThresholdControlsPlugin
    //             config={config}
    //             fieldConfig={fieldConfig}
    //             onThresholdsChange={onThresholdsChange}
    //           />
    //         )}
    //       </>
    //     );
    //   }}
    // </TimeSeries>
  );
};
