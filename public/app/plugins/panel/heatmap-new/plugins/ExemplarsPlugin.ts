import { GrafanaTheme2 } from '@grafana/data';
import { UPlotConfigBuilder } from '@grafana/ui';

import { HeatmapData, getHeatmapFields } from '../fields';
import { PanelOptions } from '../models.gen';

interface ExemplarsPluginProps {
  u: uPlot;
  config: UPlotConfigBuilder;
  heatmap: HeatmapData;
  theme: GrafanaTheme2;
  options: PanelOptions;
}

export const ExemplarsPlugin = ({ u, heatmap, config, theme, options }: ExemplarsPluginProps) => {
  const { ctx } = u;
  const [xField, yField, countField] = getHeatmapFields(heatmap.heatmap!);
  const cellGap = (options.cellGap ?? 3) - 1;
  const cellSize = options.cellSize ?? 10;

  const xMin = u.scales['x'].min!;
  const xMax = u.scales['x'].max!;
  const yMin = u.scales['y'].min!;
  const yMax = u.scales['y'].max!;

  if (xField && yField && countField) {
    countField.values.toArray().forEach((_: number, i: number) => {
      const mapping: number[] | null = heatmap.exemplarsMappings?.lookup[i]!;
      if (mapping) {
        const xVal = xField.values.get(i);
        const yVal = yField.values.get(i);
        const count = mapping.length;
        if (count > 0 && xVal >= xMin && xVal <= xMax && yVal >= yMin && yVal <= yMax) {
          let x = Math.round(u.valToPos(xVal! + heatmap.xBucketSize!, 'x', true));
          let y = Math.round(u.valToPos(yVal + heatmap.yBucketSize!, 'y', true));
          ctx.beginPath();
          ctx.moveTo(x - cellSize - cellGap, y + cellGap);
          ctx.lineTo(x - cellGap, y + cellGap);
          ctx.lineTo(x - cellGap, y + cellSize + cellGap);
          ctx.lineTo(x - cellSize - cellGap, y + cellGap);
          ctx.strokeStyle = theme.colors.background.canvas;
          ctx.fillStyle = theme.colors.background.primary;
          ctx.fill();
          ctx.stroke();
        }
      }
    });
  }
  ctx.save();
};
