import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
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

  const { froms, tos, colors } = useMemo(
    () => ({
      froms: getValues('time'),
      tos: getValues('timeEnd'),
      colors: getValues('color'),
    }),
    [getValues]
  );

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

      for (let i = 0; i < froms.length; i++) {
        let from = froms[i];
        let to = tos[i];

        let x = u.valToPos(from, 'x', true);
        let y = u.bbox.top;
        let w = u.valToPos(to, 'x', true) - x;
        let h = u.bbox.height;

        const color = theme.visualization.getColorByName(colors[i]);

        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);

        // line
        ctx.strokeStyle = colorManipulator.alpha(color, 1);
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
      }

      ctx.restore();
    });
  }, [config, froms, tos, colors, theme]);

  return null;
};
