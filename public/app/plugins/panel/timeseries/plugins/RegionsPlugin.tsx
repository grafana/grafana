import { useCallback, useLayoutEffect, useRef } from 'react';
import uPlot from 'uplot';

import { DataFrame, colorManipulator } from '@grafana/data';
import { UPlotConfigBuilder, useTheme2 } from '@grafana/ui';

interface RegionsPluginProps {
  config: UPlotConfigBuilder;
  regions: DataFrame[];
}

export const RegionsPlugin = ({ regions, config }: RegionsPluginProps) => {
  const theme = useTheme2();
  const plotInstance = useRef<uPlot>();

  const getValues = useCallback(
    (fieldName: string) => {
      let values: any[] = [];
      regions.forEach((region) => {
        region.fields
          .find((f) => f.name === fieldName)!
          .values.toArray()
          .map((v) => values.push(v));
      });

      return values;
    },
    [regions]
  );

  const fromsRef = useRef<number[]>(getValues('time'));
  const tosRef = useRef<number[]>(getValues('timeEnd'));
  const colorsRef = useRef<string[]>(getValues('color'));
  const linesRef = useRef<string[]>(getValues('line'));

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });

    config.addHook('drawClear', (u) => {
      const ctx = u.ctx;

      ctx.save();

      ctx.beginPath();
      ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
      ctx.clip();

      const renderLine = (x: number, color: string) => {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = colorManipulator.alpha(color, 1);
        ctx.moveTo(x, u.bbox.top);
        ctx.lineTo(x, u.bbox.top + u.bbox.height);
        ctx.stroke();
        ctx.closePath();
      };

      for (let i = 0; i < fromsRef.current.length; i++) {
        let from = fromsRef.current[i];
        let to = tosRef.current[i];

        let x = u.valToPos(from, 'x', true);
        let y = u.bbox.top;
        let w = u.valToPos(to, 'x', true) - x;
        let h = u.bbox.height;

        w = w === 0 ? 1 : w;

        const color = theme.visualization.getColorByName(colorsRef.current[i]);

        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);

        if (linesRef.current[i]) {
          renderLine(x, color);

          const x1 = u.valToPos(to, 'x', true);
          renderLine(x1, color);
        }
      }

      ctx.restore();
    });
  }, [config, theme.visualization]);

  return null;
};
