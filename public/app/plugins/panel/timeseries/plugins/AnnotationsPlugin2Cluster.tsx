import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import tinycolor from 'tinycolor2';
import uPlot from 'uplot';

import { colorManipulator, type InterpolateFunction } from '@grafana/data';
import { type DataFrame } from '@grafana/data/dataframe';
import { type TimeZone, type VizAnnotations } from '@grafana/schema';
import {
  DEFAULT_ANNOTATION_COLOR,
  getPortalContainer,
  type UPlotConfigBuilder,
  usePanelContext,
  useTheme2,
} from '@grafana/ui';
import { type TimeRange2 } from '@grafana/ui/internal';

import { AnnotationMarker2 } from './annotations2-cluster/AnnotationMarker2';
import { type AnnotationVals, type XYAnnoVals } from './annotations2-cluster/types';
import { ClusteringMode, useAnnotationClustering } from './annotations2-cluster/useAnnotationClustering';
import { useAnnotations } from './annotations2-cluster/useAnnotations';
import {
  ANNOTATION_LANE_SIZE,
  getAnnoRegionBoxStyle,
  shouldRenderAnnotationLine,
  shouldRenderAnnotationRegion,
} from './utils';

interface AnnotationsPlugin2ClusterProps {
  config: UPlotConfigBuilder;
  options: VizAnnotations | undefined;
  annotations?: DataFrame[];
  timeZone: TimeZone;
  newRange: TimeRange2 | null;
  setNewRange: (newRange: TimeRange2 | null) => void;
  canvasRegionRendering?: boolean;
  replaceVariables: InterpolateFunction;
}

// TODO: batch by color, use Path2D objects
const renderLine = (ctx: CanvasRenderingContext2D, y0: number, y1: number, x: number, color: string) => {
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.strokeStyle = color;
  ctx.stroke();
};

const DEFAULT_ANNOTATION_COLOR_HEX8 = tinycolor(DEFAULT_ANNOTATION_COLOR).toHex8String();

function getVals<T = AnnotationVals | {}>(frame: DataFrame) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  let vals = {} as T;
  for (const f of frame.fields) {
    // @ts-expect-error data frames have unknown value types but we can assert that they have string indices since the annotation fields spec is hardcoded.
    vals[f.name] = f.values;
  }

  return vals;
}
/**
 * Refactored version of the AnnotationsPlugin2 behind `annotationsClustering` feature flag.
 * @param annotations
 * @param timeZone
 * @param config
 * @param newRange
 * @param setNewRange
 * @param replaceVariables
 * @param canvasRegionRendering
 * @param options
 * @constructor
 */
export const AnnotationsPlugin2Cluster = ({
  annotations,
  timeZone,
  config,
  newRange,
  setNewRange,
  replaceVariables,
  canvasRegionRendering = true,
  options,
}: AnnotationsPlugin2ClusterProps) => {
  const plotRef = useRef<uPlot | null>(null);
  const plotRangeRef = useRef<TimeRange2>({
    from: plotRef.current?.scales?.x?.min ?? -1,
    to: plotRef.current?.scales?.x?.max ?? -1,
  });
  const [portalRoot] = useState(() => getPortalContainer());
  const [pinnedAnnotationId, setPinnedAnnotationId] = useState<string | undefined>();
  const getColorByName = useTheme2().visualization.getColorByName;

  const [_, forceUpdate] = useReducer((x) => x + 1, 0);

  const clusteringMode: ClusteringMode | null =
    options?.clustering && options.clustering > 0 ? ClusteringMode.Render : null;
  const { canExecuteActions } = usePanelContext();
  const userCanExecuteActions = canExecuteActions?.() ?? false;

  const { xAnnos, xyAnnos } = useAnnotations({ annotations, newRange });

  const { annotations: clusteredAnnos } = useAnnotationClustering({
    annotations: xAnnos,
    clusteringMode,
    plotWidth: plotRef.current?.bbox.width,
    // if the plot hasn't defined the time range yet, we don't want to cluster until it does
    timeRange: plotRangeRef.current,
  });

  const exitWipEdit = useCallback(() => {
    setNewRange(null);
  }, [setNewRange]);

  const xAnnoRef = useRef(clusteredAnnos);
  xAnnoRef.current = clusteredAnnos;

  const xyAnnoRef = useRef(xyAnnos);
  xyAnnoRef.current = xyAnnos;

  const newRangeRef = useRef(newRange);
  newRangeRef.current = newRange;

  const xAxisRef = useRef<HTMLDivElement | undefined>(undefined);

  useLayoutEffect(() => {
    config.addHook('ready', (u) => {
      xAxisRef.current = u.root.querySelector<HTMLDivElement>('.u-axis')!;
      plotRef.current = u;
      // If annos were defined before uPlot ready is called, we need to force the component to re-render annos now that uplot is available
      if (annotations?.length) {
        forceUpdate();
      }
    });

    config.addHook('drawAxes', (u) => {
      const newFrom = u.scales?.x?.min ?? -1;
      const newTo = u?.scales?.x?.max ?? -1;

      // If time range changed after the annotations were already rendered (since the panel query updates plot time range unlike annotation queries), we need to force react update to render updated marker locations
      if (plotRangeRef.current?.from !== newFrom || plotRangeRef.current?.to !== newTo) {
        plotRangeRef.current = { from: newFrom, to: newTo };
        if (annotations?.length) {
          forceUpdate();
        }
      }
    });

    config.addHook('draw', (u) => {
      const xAnnos = xAnnoRef.current;
      const xyAnnos = xyAnnoRef.current;
      const ctx = u.ctx;

      ctx.save();

      ctx.beginPath();
      ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
      ctx.clip();

      const shouldRenderRegion = shouldRenderAnnotationRegion(options?.regions?.opacity, options?.multiLane);
      const shouldRenderLine = shouldRenderAnnotationLine(options?.lines?.width, options?.multiLane);
      const regionOpacity = options?.regions?.opacity;
      const lineWidth = options?.lines?.width;

      // Multi-lane annotations do not support vertical lines or shaded regions
      xAnnos.forEach((frame) => {
        const vals = getVals<AnnotationVals>(frame);

        // render line
        if (shouldRenderLine) {
          const y0 = u.bbox.top;
          const y1 = y0 + u.bbox.height;

          ctx.lineWidth = lineWidth ?? 2;
          ctx.setLineDash([5, 5]);

          // Render region
          if (shouldRenderRegion) {
            for (let i = 0; i < vals.time.length; i++) {
              // skip rendering annos that are clustered (have non-null cluster index)
              if (skipClusteredAnno(vals, i)) {
                continue;
              }
              const isRegion = vals.isRegion?.[i];
              const timeEnd = vals.timeEnd?.[i];
              const color = getColorByName(vals.color?.[i] ?? DEFAULT_ANNOTATION_COLOR_HEX8);

              const x0 = u.valToPos(vals.time[i], 'x', true);
              renderLine(ctx, y0, y1, x0, color);

              // If dataframe does not have end times, let's omit rendering the region for now to prevent runtime error in valToPos
              // @todo do we want to fix isRegion to render a point (or use "to" as timeEnd) when we're missing timeEnd?
              if (isRegion && timeEnd) {
                const x1 = u.valToPos(timeEnd, 'x', true);
                renderLine(ctx, y0, y1, x1, color);

                if (canvasRegionRendering) {
                  ctx.fillStyle = colorManipulator.alpha(color, regionOpacity ?? 0.1);
                  ctx.fillRect(x0, y0, x1 - x0, u.bbox.height);
                }
              }
            }
          }
        }
      });

      // xMin, xMax, yMin, yMax, color, lineWidth, lineStyle, fillOpacity, text
      xyAnnos.forEach((frame) => {
        const vals = getVals<XYAnnoVals>(frame);

        const xKey = config.scales[0].props.scaleKey;
        const yKey = config.scales[1].props.scaleKey;

        for (let i = 0; i < frame.length; i++) {
          const color = getColorByName(vals.color?.[i] || DEFAULT_ANNOTATION_COLOR_HEX8);

          const x0 = u.valToPos(vals.xMin?.[i], xKey, true);
          const x1 = u.valToPos(vals.xMax?.[i], xKey, true);
          const y0 = u.valToPos(vals.yMax?.[i], yKey, true);
          const y1 = u.valToPos(vals.yMin?.[i], yKey, true);

          ctx.fillStyle = colorManipulator.alpha(color, vals.fillOpacity[i]);
          ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

          ctx.lineWidth = Math.round(vals.lineWidth[i] * uPlot.pxRatio);

          if (vals.lineStyle[i] === 'dash') {
            // maybe extract this to vals.lineDash[i] in future?
            ctx.setLineDash([5, 5]);
          } else {
            // solid
            ctx.setLineDash([]);
          }

          ctx.strokeStyle = color;
          ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        }
      });

      ctx.restore();
    });
  }, [
    config,
    canvasRegionRendering,
    getColorByName,
    options?.multiLane,
    options?.clustering,
    options?.lines?.width,
    options?.regions?.opacity,
    annotations?.length,
  ]);

  // ensure clusteredAnnos are re-drawn whenever they change
  useEffect(() => {
    if (plotRef.current) {
      plotRef.current.redraw(false, true);
    }
  }, [clusteredAnnos]);

  if (plotRef.current && xAxisRef.current) {
    const plot = plotRef.current;
    const wipFrame = xAnnos.filter((fr) => fr.meta?.custom?.isWip)?.[0];
    const wipVals = wipFrame ? getVals<AnnotationVals>(wipFrame) : null;
    const isWipVisible = wipFrame?.meta?.custom?.isWip && wipVals?.time?.[0] && wipVals?.time?.[0] > 0;

    const markers = xAnnoRef.current.flatMap((frame, frameIdx) => {
      const isWipFrame = frame?.meta?.custom?.isWip;
      const vals = getVals<AnnotationVals>(frame);
      const markers: React.ReactNode[] = [];

      // Top offset for multi-lane annotations
      const top = options?.multiLane ? frameIdx * ANNOTATION_LANE_SIZE : undefined;

      for (let i = 0; i < vals.time.length; i++) {
        if (skipClusteredAnno(vals, i)) {
          continue;
        }
        const isRegion = vals.isRegion?.[i];
        const timeEnd = vals.timeEnd?.[i];
        const color = getColorByName(vals.color?.[i] || DEFAULT_ANNOTATION_COLOR);
        const left = Math.round(plot.valToPos(vals.time[i], 'x')) || 0; // handles -0

        let style: React.CSSProperties | null = null;
        let isVisible = true;
        const plotWidth = plot.rect.width;

        if (isRegion && timeEnd != null) {
          const valPos = plot.valToPos(timeEnd, 'x');
          const right = Math.round(valPos ?? 0) || 0; // handles -0
          isVisible = left < plotWidth && right > 0;

          if (isVisible) {
            style = { ...getAnnoRegionBoxStyle(plotWidth, right, left), background: color, top };
          }
        } else {
          isVisible = left >= 0 && left <= plotWidth;

          if (isVisible) {
            style = { left, borderBottomColor: color, top };
          }
        }

        // @TODO: Reset newRange after annotation is saved
        if (isVisible) {
          const annotationKey = getAnnotationKey(frameIdx, i);
          const setPinned = (active: boolean) => {
            if (active) {
              setPinnedAnnotationId(annotationKey);
            } else {
              setPinnedAnnotationId(undefined);
            }
          };

          // Do not let other tooltips render if one is already pinned, or the wip is being edited
          const showTooltipOnHover = !pinnedAnnotationId && !isWipVisible;

          // The tooltip should render as pinned if the pinned state index matches this annotation
          const isPinned = pinnedAnnotationId === annotationKey;

          markers.push(
            <AnnotationMarker2
              key={annotationKey}
              setPinned={setPinned}
              isPinned={isPinned}
              showTooltipOnHover={showTooltipOnHover}
              frame={frame}
              annoIdx={i}
              annoVals={vals}
              style={style}
              timeZone={timeZone}
              exitWipEdit={isWipFrame ? exitWipEdit : null}
              portalRoot={portalRoot}
              canExecuteActions={userCanExecuteActions}
              replaceVariables={replaceVariables}
            />
          );
        }
      }

      return markers;
    });

    return createPortal(markers, xAxisRef.current);
  }

  return null;
};

/**
 * Defines when to skip rendering a clustered annotation
 * @param vals
 * @param i
 */
const skipClusteredAnno = (vals: AnnotationVals, i: number) => {
  return (
    // We use the clusterIdx to define when an annotation is a cluster
    !vals.isCluster?.[i] && vals.clusterIdx?.[i] != null && vals.clusterIdx?.[i] >= 0
  );
};

/**
 * helper method to return a unique identifier for an annotation
 * @param frameIdx
 * @param i
 */
const getAnnotationKey = (frameIdx: number, i: number) => {
  return `${frameIdx}:${i}`;
};
