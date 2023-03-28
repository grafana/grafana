import { useLayoutEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';

import { DataFrame } from '@grafana/data';
import { UPlotConfigBuilder, useTheme2 } from '@grafana/ui';

interface RegionsPluginProps {
  config: UPlotConfigBuilder;
  regions: DataFrame[];
}

export const RegionsPlugin = ({ regions, config }: RegionsPluginProps) => {
  const theme = useTheme2();
  const plotInstance = useRef<uPlot>();

  const { froms, tos, colors } = useMemo(
    () => ({
      froms: regions[0].fields.find((f) => f.name === 'time')!.values.toArray(),
      tos: regions[0].fields.find((f) => f.name === 'timeEnd')!.values.toArray(),
      colors: regions[0].fields.find((f) => f.name === 'color')!.values.toArray(),
    }),
    [regions]
  );

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });

    config.addHook('drawClear', (u) => {
      const ctx = u.ctx;

      ctx.save();

      for (let i = 0; i < froms.length; i++) {
        let from = froms[i];
        let to = tos[i];

        let x = u.valToPos(from, 'x', true);
        let y = u.bbox.top;
        let w = u.valToPos(to, 'x', true) - x;
        let h = u.bbox.height;

        ctx.fillStyle = theme.visualization.getColorByName(colors[i]);
        ctx.fillRect(x, y, w, h);
      }

      ctx.restore();
    });
  }, [config, froms, tos, colors, theme]);

  return null;
};
