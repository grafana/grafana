import { GrafanaTheme2 } from '@grafana/data';
import { UPlotConfigBuilder } from '@grafana/ui';

import { HeatmapData } from '../fields';
import { PanelOptions } from '../models.gen';
import { getHeatmapArrays } from '../utils';

interface ExemplarsPluginProps {
  u: uPlot;
  config: UPlotConfigBuilder;
  exemplars: HeatmapData;
  theme: GrafanaTheme2;
  options: PanelOptions;
}

export const ExemplarsPlugin = ({ u, exemplars, config, theme, options }: ExemplarsPluginProps) => {
  const { ctx } = u;
  const [xField, yField, countField] = getHeatmapArrays(exemplars.heatmap!);
  const cellGap = (options.cellGap ?? 3) - 1;
  const cellSize = options.cellSize ?? 10;

  console.log('optoins', options);
  const xMin = u.scales['x'].min!;
  const xMax = u.scales['x'].max!;
  const yMin = u.scales['y'].min!;
  const yMax = u.scales['y'].max!;

  if (xField && yField && countField) {
    countField.forEach((count, i) => {
      const xVal = xField[i];
      const yVal = yField[i];
      if (count > 0 && xVal >= xMin && xVal <= xMax && yVal >= yMin && yVal <= yMax) {
        let x = Math.round(u.valToPos(xVal! + exemplars.xBucketSize!, 'x', true));
        let y = Math.round(u.valToPos(yVal + exemplars.yBucketSize!, 'y', true));
        ctx.beginPath();
        ctx.moveTo(x - cellSize - cellGap, y + cellGap);
        ctx.lineTo(x - cellGap, y + cellGap);
        ctx.lineTo(x - cellGap, y + cellSize + cellGap);
        ctx.lineTo(x - cellSize - cellGap, y + cellGap);
        ctx.strokeStyle = theme.colors.background.canvas;
        ctx.fillStyle = theme.visualization.palette[count - 1];
        ctx.fill();
        ctx.stroke();
      }
    });
  }
  ctx.save();
};
