import { css } from '@emotion/css';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import uPlot from 'uplot';

import { DataFrame, GrafanaTheme2, colorManipulator } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { UPlotConfigBuilder, useStyles2, useTheme2 } from '@grafana/ui';

interface AnnotationsPluginProps {
  config: UPlotConfigBuilder;
  annotations: DataFrame[];
  timeZone: TimeZone;
}

// TODO: batch by color, use Path2D objects
const renderLine = (ctx: CanvasRenderingContext2D, y0: number, y1: number, x: number, color: string) => {
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.strokeStyle = color;
  ctx.stroke();
};

export const AnnotationsPlugin2 = ({ annotations, timeZone, config }: AnnotationsPluginProps) => {
  const [plot, setPlot] = useState<uPlot>();

  const styles = useStyles2(getStyles);
  const getColorByName = useTheme2().visualization.getColorByName;

  const annoRef = useRef(annotations);
  annoRef.current = annotations;

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
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
        let vals: Record<string, any[]> = {};
        frame.fields.forEach((f) => {
          vals[f.name] = f.values;
        });

        for (let i = 0; i < frame.length; i++) {
          let color = getColorByName(vals.color[i]);

          let x0 = u.valToPos(vals.time[i], 'x', true);
          renderLine(ctx, y0, y1, x0, color);

          if (vals.isRegion[i]) {
            let x1 = u.valToPos(vals.timeEnd[i], 'x', true);

            renderLine(ctx, y0, y1, x1, color);

            ctx.rect(x0, y0, x1 - x0, u.bbox.height);
            ctx.fillStyle = colorManipulator.alpha(color, 0.1);
            ctx.fill();
          }
        }
      });

      ctx.restore();
    });
  }, [config, getColorByName]);

  if (plot) {
    return createPortal(<div className={styles.annoMarkers}></div>, plot.over);
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2) => ({
  annoMarkers: css({
    position: 'absolute',
    top: '100%',
    width: '100%',
    height: '4px',
    left: 0,
    background: 'red',
  }),
});
