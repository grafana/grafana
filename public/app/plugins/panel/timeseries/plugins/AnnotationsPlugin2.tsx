import { css } from '@emotion/css';
import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import tinycolor from 'tinycolor2';
import uPlot from 'uplot';

import { arrayToDataFrame, colorManipulator, DataFrame, DataTopic, InterpolateFunction } from '@grafana/data';
import { maybeSortFrame } from '@grafana/data/internal';
import { TimeZone, VizAnnotations } from '@grafana/schema';
import {
  DEFAULT_ANNOTATION_COLOR,
  getPortalContainer,
  UPlotConfigBuilder,
  usePanelContext,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { TimeRange2 } from '@grafana/ui/internal';

import { AnnotationMarker2 } from './annotations2/AnnotationMarker2';
import { useAnnotationClustering } from './annotations2/useAnnotationClustering';
import { ANNOTATION_LANE_SIZE, getXAnnotationFrames, getXYAnnotationFrames } from './utils';

interface AnnotationsPluginProps {
  config: UPlotConfigBuilder;
  annotationsOptions: VizAnnotations | undefined;
  annotations: DataFrame[];
  timeZone: TimeZone;
  newRange: TimeRange2 | null;
  setNewRange: (newRage: TimeRange2 | null) => void;
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

enum ClusteringMode {
  Hover = 'hover',
  Render = 'render',
}

const DEFAULT_ANNOTATION_COLOR_HEX8 = tinycolor(DEFAULT_ANNOTATION_COLOR).toHex8String();

export type AnnotationVals = {
  id?: number[];
  dashboardUID?: string[];
  time: number[];
  timeEnd?: number[];
  text?: string[];
  title?: string[];
  isRegion?: boolean[];
  color?: string[];
  alertId?: number[];
  newState?: string[];
  /** Alert payload per row (e.g. evalMatches, error) for getAlertAnnotationText */
  data?: unknown[];
  login?: string[];
  avatarUrl?: string[];
  tags?: string[][];
  clusterIdx?: Array<number | null>;
};

export type XYAnnoVals = {
  color: string[];
  xMin: number[];
  xMax: number[];
  yMax: number[];
  yMin: number[];
  fillOpacity: number[];
  lineWidth: number[];
  lineStyle: string[];
};

function getVals<T = AnnotationVals | {}>(frame: DataFrame) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  let vals = {} as T;
  frame.fields.forEach((f) => {
    // @ts-ignore
    vals[f.name] = f.values;
  });

  return vals;
}

/**
 * edit mode wip frame
 * @param newRange
 */
const buildWipAnnoFrame = (newRange: TimeRange2) => {
  let isRegion = newRange.to > newRange.from;

  const wipAnnoFrame = arrayToDataFrame([
    {
      time: newRange.from,
      timeEnd: isRegion ? newRange.to : null,
      isRegion: isRegion,
      // #00d3ffff
      color: DEFAULT_ANNOTATION_COLOR_HEX8,
    },
  ]);

  wipAnnoFrame.meta = {
    dataTopic: DataTopic.Annotations,
    custom: {
      isWip: true,
    },
  };
  return wipAnnoFrame;
};

export const AnnotationsPlugin2 = ({
  annotations,
  timeZone,
  config,
  newRange,
  setNewRange,
  replaceVariables,
  canvasRegionRendering = true,
  annotationsOptions,
}: AnnotationsPluginProps) => {
  const [plot, setPlot] = useState<uPlot>();
  const [portalRoot] = useState(() => getPortalContainer());
  const [annoIdx, setAnnoIdx] = useState<string | undefined>();
  const styles = useStyles2(getStyles);
  const getColorByName = useTheme2().visualization.getColorByName;

  const [_, forceUpdate] = useReducer((x) => x + 1, 0);

  const clusteringMode: ClusteringMode | null = annotationsOptions?.clustering ? ClusteringMode.Render : null;
  const { canExecuteActions } = usePanelContext();
  const userCanExecuteActions = canExecuteActions?.() ?? false;

  const { xAnnos, xyAnnos } = useMemo(() => {
    const xAnnos = getXAnnotationFrames(annotations).map((frame) =>
      maybeSortFrame(
        frame,
        frame.fields.findIndex((field) => field.name === 'time')
      )
    );

    const xyAnnos = getXYAnnotationFrames(annotations);

    if (newRange) {
      const wipAnnoFrame = buildWipAnnoFrame(newRange);
      xAnnos.push(wipAnnoFrame);
    }

    return {
      xAnnos,
      xyAnnos,
    };
  }, [annotations, newRange]);

  const clusteredAnnos = useAnnotationClustering({
    annotations: xAnnos,
    clusteringMode,
    plotBox: plot?.bbox,
    timeRange: { from: plot?.scales?.x?.min ?? -1, to: plot?.scales?.x?.max ?? -1 },
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
      setPlot(u);
    });

    config.addHook('draw', (u) => {
      const xAnnos = xAnnoRef.current;
      const xyAnnos = xyAnnoRef.current;
      const ctx = u.ctx;

      ctx.save();
      ctx.beginPath();
      ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
      ctx.clip();

      // @todo Add panel options instead of disabling for multiLane and enabling for clustering
      const shouldRenderRegion = !annotationsOptions?.multiLane || annotationsOptions.clustering;
      const shouldRenderLine = !annotationsOptions?.multiLane || annotationsOptions.clustering;

      // Multi-lane annotations do not support vertical lines or shaded regions
      xAnnos.forEach((frame) => {
        const vals = getVals<AnnotationVals>(frame);

        // render line
        if (shouldRenderLine) {
          let y0 = u.bbox.top;
          let y1 = y0 + u.bbox.height;

          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);

          // Render region
          if (shouldRenderRegion) {
            for (let i = 0; i < vals.time.length; i++) {
              // skip rendering annos that are clustered (have non-null cluster index)
              if (skipClusteredAnno(vals, i)) {
                continue;
              }
              let color = getColorByName(vals.color?.[i] ?? DEFAULT_ANNOTATION_COLOR_HEX8);

              let x0 = u.valToPos(vals.time[i], 'x', true);
              renderLine(ctx, y0, y1, x0, color);

              // If dataframe does not have end times, let's omit rendering the region for now to prevent runtime error in valToPos
              // @todo do we want to fix isRegion to render a point (or use "to" as timeEnd) when we're missing timeEnd?

              if (vals.isRegion?.[i] && vals.timeEnd?.[i]) {
                let x1 = u.valToPos(vals.timeEnd[i], 'x', true);
                renderLine(ctx, y0, y1, x1, color);

                if (canvasRegionRendering) {
                  ctx.fillStyle = colorManipulator.alpha(color, 0.1);
                  ctx.fillRect(x0, y0, x1 - x0, u.bbox.height);
                }
              }
            }
          }
        }
      });

      // xMin, xMax, yMin, yMax, color, lineWidth, lineStyle, fillOpacity, text
      xyAnnos.forEach((frame) => {
        let vals = getVals<XYAnnoVals>(frame);

        let xKey = config.scales[0].props.scaleKey;
        let yKey = config.scales[1].props.scaleKey;

        for (let i = 0; i < frame.length; i++) {
          let color = getColorByName(vals.color?.[i] || DEFAULT_ANNOTATION_COLOR_HEX8);

          let x0 = u.valToPos(vals.xMin?.[i]!, xKey, true);
          let x1 = u.valToPos(vals.xMax?.[i]!, xKey, true);
          let y0 = u.valToPos(vals.yMax?.[i]!, yKey, true);
          let y1 = u.valToPos(vals.yMin?.[i]!, yKey, true);

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
  }, [config, canvasRegionRendering, getColorByName, annotationsOptions?.multiLane, annotationsOptions?.clustering]);

  // ensure xAnnos are re-drawn whenever they change
  useEffect(() => {
    if (plot) {
      plot.redraw();

      // this forces a second redraw after uPlot is updated (in the Plot.tsx didUpdate) with new data/scales
      // and ensures the anno marker positions in the dom are re-rendered in correct places
      // (this is temp fix until uPlot integration is refactored)
      setTimeout(() => {
        forceUpdate();
      }, 0);
    }
  }, [xAnnos, plot]);

  // Set active annotation tooltip state
  const setAnnotationIndex = useCallback((annoIdx: string | undefined) => {
    setAnnoIdx(annoIdx);
  }, []);

  if (plot) {
    const markers = xAnnoRef.current.flatMap((frame, frameIdx) => {
      const vals = getVals<AnnotationVals>(frame);
      const markers: React.ReactNode[] = [];

      // Top offset for multi-lane annotations
      const top = annotationsOptions?.multiLane ? frameIdx * ANNOTATION_LANE_SIZE : undefined;

      for (let i = 0; i < vals.time.length; i++) {
        if (skipClusteredAnno(vals, i)) {
          continue;
        }
        let color = getColorByName(vals.color?.[i] || DEFAULT_ANNOTATION_COLOR);
        let left = Math.round(plot.valToPos(vals.time[i], 'x')) || 0; // handles -0
        let style: React.CSSProperties | null = null;
        let className = '';
        let isVisible = true;

        if (vals.isRegion?.[i] && vals.timeEnd?.[i] !== undefined) {
          let right = Math.round(plot.valToPos(vals.timeEnd[i], 'x')) || 0; // handles -0

          isVisible = left < plot.rect.width && right > 0;

          if (isVisible) {
            let clampedLeft = Math.max(0, left);
            let clampedRight = Math.min(plot.rect.width, right);

            style = { left: clampedLeft, background: color, width: clampedRight - clampedLeft, top };
            className = styles.annoRegion;
          }
        } else {
          isVisible = left >= 0 && left <= plot.rect.width;

          if (isVisible) {
            style = { left, borderBottomColor: color, top };
            className = styles.annoMarker;
          }
        }

        // @TODO: Reset newRange after annotation is saved
        if (isVisible) {
          const isWip = frame.meta?.custom?.isWip;
          const setAnnotation = (active: boolean) => {
            if (active) {
              setAnnotationIndex(`${frameIdx}:${i}`);
            } else {
              setAnnotationIndex(undefined);
            }
          };

          markers.push(
            <AnnotationMarker2
              pinAnnotation={setAnnotation}
              isPinned={annoIdx === `${frameIdx}:${i}`}
              showOnHover={!annoIdx}
              frame={frame}
              annoIdx={i}
              annoVals={vals}
              className={className}
              style={style}
              timeZone={timeZone}
              key={`${frameIdx}:${i}`}
              exitWipEdit={isWip ? exitWipEdit : null}
              portalRoot={portalRoot}
              canExecuteActions={userCanExecuteActions}
              replaceVariables={replaceVariables}
            />
          );
        }
      }

      return markers;
    });

    return createPortal(markers, xAxisRef.current!);
  }

  return null;
};

const getStyles = () => ({
  annoMarker: css({
    position: 'absolute',
    width: 0,
    height: 0,
    border: 'none',
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    borderBottomWidth: '5px',
    borderBottomStyle: 'solid',
    transform: 'translateX(-50%)',
    cursor: 'pointer',
    zIndex: 1,
    padding: 0,
    background: 'none',
  }),
  annoRegion: css({
    border: 'none',
    position: 'absolute',
    height: '5px',
    cursor: 'pointer',
    zIndex: 1,
    padding: 0,
    background: 'none',
  }),
});

const skipClusteredAnno = (vals: AnnotationVals, i: number) => {
  return (
    !vals.isRegion?.[i] &&
    vals.clusterIdx?.[i] !== undefined &&
    vals.clusterIdx?.[i] !== null &&
    vals.clusterIdx?.[i] >= 0
  );
};
