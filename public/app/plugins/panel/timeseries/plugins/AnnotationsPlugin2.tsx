import { css } from '@emotion/css';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useDebounce from 'react-use/lib/useDebounce';
import uPlot from 'uplot';

import { DataFrame, GrafanaTheme2, TimeRange, colorManipulator } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { UPlotConfigBuilder, useStyles2, useTheme2 } from '@grafana/ui';

// (copied from TooltipPlugin2)
interface TimeRange2 {
  from: number;
  to: number;
}

interface AnnotationsPluginProps {
  config: UPlotConfigBuilder;
  annotations: DataFrame[];
  timeZone: TimeZone;
  newRange: TimeRange2 | null;
}

// TODO: batch by color, use Path2D objects
const renderLine = (ctx: CanvasRenderingContext2D, y0: number, y1: number, x: number, color: string) => {
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.strokeStyle = color;
  ctx.stroke();
};

// const renderUpTriangle = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
//   ctx.beginPath();
//   ctx.moveTo(x - w/2, y + h/2);
//   ctx.lineTo(x + w/2, y + h/2);
//   ctx.lineTo(x, y);
//   ctx.closePath();
//   ctx.fillStyle = color;
//   ctx.fill();
// }

interface AnnoBoxProps {
  annoVals: Record<string, any[]>;
  annoIdx: number;
  style: React.CSSProperties | null;
  className: string;
  isWip?: boolean;
}

function getValsWithNew(frame: DataFrame, newRange: TimeRange2 | null) {
  let vals: Record<string, any[]> = {};
  frame.fields.forEach((f) => {
    vals[f.name] = newRange == null ? f.values : f.values.slice();
  });

  // append new WIP anno to render
  if (newRange != null) {
    let isRegion = newRange.to > newRange.from;

    // ...append new Marker, with newRange and isWip: true
    for (let name in vals) {
      let d = vals[name];

      if (name === 'time') {
        d.push(newRange.from);
      } else if (name === 'timeEnd') {
        d.push(isRegion ? newRange.to : null);
      } else if (name === 'isRegion') {
        d.push(isRegion);
      } else if (name === 'color') {
        d.push('rgba(0, 211, 255, 1)');
      } else {
        d.push(null);
      }
    }
  }

  return vals;
}

export const Marker = ({ annoVals, annoIdx, className, style, isWip }: AnnoBoxProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const domRef = React.createRef<HTMLDivElement>();

  // similar to TooltipPlugin2, when editing annotation (pinned), it should boost z-index
  const setIsEditingWrap = (isEditing: boolean) => {
    domRef.current!.closest<HTMLDivElement>('.react-grid-item')?.classList.toggle('context-menu-open', isEditing);
    setIsEditing(isEditing);
  };

  // doesnt work to auto-activate edit mode? :(
  useLayoutEffect(
    () => {
      isWip && setIsEditingWrap(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const styles = useStyles2(getStyles);

  const text = annoVals.text[annoIdx];

  return (
    <div
      ref={domRef}
      className={className}
      style={style!}
      onMouseEnter={() => !isEditing && setIsHovered(true)}
      onMouseLeave={() => !isEditing && setIsHovered(false)}
    >
      {isHovered && (
        <div className={styles.annoInfo}>
          {isEditing ? <textarea value={text} /> : text}
          <br />
          {isEditing ? (
            <button onClick={() => setIsEditingWrap(false)}>Save</button>
          ) : (
            <button onClick={() => setIsEditingWrap(true)}>Edit</button>
          )}
        </div>
      )}
    </div>
  );
};

export const AnnotationsPlugin2 = ({ annotations, timeZone, config, newRange }: AnnotationsPluginProps) => {
  const [plot, setPlot] = useState<uPlot>();

  const styles = useStyles2(getStyles);
  const getColorByName = useTheme2().visualization.getColorByName;

  const annoRef = useRef(annotations);
  annoRef.current = annotations;
  const newRangeRef = useRef(newRange);
  newRangeRef.current = newRange;

  const xAxisRef = useRef<HTMLDivElement>();

  useLayoutEffect(() => {
    config.addHook('ready', (u) => {
      let xAxisEl = u.root.querySelector<HTMLDivElement>('.u-axis')!;
      xAxisRef.current = xAxisEl;
      setPlot(u);
    });

    config.addHook('draw', (u) => {
      let annos = annoRef.current;

      const ctx = u.ctx;

      let y0 = u.bbox.top;
      let y1 = y0 + u.bbox.height;

      ctx.save();

      ctx.beginPath();
      ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
      ctx.clip();

      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      annos.forEach((frame) => {
        let vals = getValsWithNew(frame, newRangeRef.current);

        for (let i = 0; i < frame.length; i++) {
          let color = getColorByName(vals.color[i]);

          let x0 = u.valToPos(vals.time[i], 'x', true);
          renderLine(ctx, y0, y1, x0, color);

          if (!vals.isRegion[i]) {
            // renderUpTriangle(ctx, x0, y1, 8 * uPlot.pxRatio, 5 * uPlot.pxRatio, color);
          } else {
            let x1 = u.valToPos(vals.timeEnd[i], 'x', true);

            renderLine(ctx, y0, y1, x1, color);

            ctx.fillStyle = colorManipulator.alpha(color, 0.1);
            ctx.fillRect(x0, y0, x1 - x0, u.bbox.height);

            // ctx.fillStyle = color;
            // ctx.fillRect(x0, y1, x1 - x0, 5);
          }
        }
      });

      ctx.restore();
    });
  }, [config, getColorByName]);

  // redraw slower-than-series anno queries, since they don't go through setData(), but are drawn in the redraw() hook
  useDebounce(
    () => {
      if (plot) {
        plot.redraw();
      }
    },
    100,
    annotations
  );

  if (plot) {
    let markers = annoRef.current.flatMap((frame) => {
      let vals = getValsWithNew(frame, newRangeRef.current);

      let markers: React.ReactNode[] = [];

      for (let i = 0; i < vals.time.length; i++) {
        let color = getColorByName(vals.color[i]);

        let left = plot.valToPos(vals.time[i], 'x');
        let style: React.CSSProperties | null = null;
        let className = '';
        let isVisible = true;

        if (vals.isRegion[i]) {
          let right = plot.valToPos(vals.timeEnd[i], 'x');

          isVisible = left < plot.rect.width && right > 0;

          if (isVisible) {
            let clampedLeft = Math.max(0, left);
            let clampedRight = Math.min(plot.rect.width, right);

            style = { left: clampedLeft, background: color, width: clampedRight - clampedLeft };
            className = styles.annoRegion;
          }
        } else {
          isVisible = left > 0 && left <= plot.rect.width;

          if (isVisible) {
            style = { left, borderBottomColor: color };
            className = styles.annoMarker;
          }
        }

        if (isVisible) {
          markers.push(<Marker annoIdx={i} annoVals={vals} className={className} style={style} />);
        }
      }

      return markers;
    });

    return createPortal(markers, xAxisRef.current!);
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2) => ({
  annoMarker: css({
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderBottomWidth: '6px',
    borderBottomStyle: 'solid',
    transform: 'translateX(-50%)',
    cursor: 'pointer',
    zIndex: 1,
  }),
  annoRegion: css({
    position: 'absolute',
    height: '5px',
    cursor: 'pointer',
    zIndex: 1,
  }),
  annoInfo: css({
    background: 'purple',
    color: 'white',
    padding: '10px',
    position: 'absolute',
    transform: 'translateX(-50%)',
    left: '50%',
    width: '300px',
    height: '100px',
    top: '5px',
  }),
});
