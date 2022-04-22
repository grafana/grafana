import { GrafanaTheme2 } from '@grafana/data';
import { UPlotConfigBuilder } from '@grafana/ui';
import { HeatmapData } from '../fields';
import { getHeatmapArrays } from '../utils';

interface ExemplarsPluginProps {
  u: uPlot;
  config: UPlotConfigBuilder;
  exemplars: HeatmapData;
  theme: GrafanaTheme2;
}

export const ExemplarsPlugin = ({ u, exemplars, config, theme }: ExemplarsPluginProps) => {
  const { ctx } = u;
  const [xField, yField, countField] = getHeatmapArrays(exemplars.heatmap!);

  const xMin = u.scales['x'].min!;
  const xMax = u.scales['x'].max!;
  const yMin = u.scales['y'].min!;
  const yMax = u.scales['y'].max!;

  if (xField && yField && countField) {
    const max = Math.max(...countField);
    const colorBinSize = theme.visualization.palette.length / max;
    countField.forEach((count, i) => {
      const xVal = xField[i];
      const yVal = yField[i];
      if (count > 0 && xVal > xMin && xVal < xMax && yVal > yMin && yVal < yMax) {
        let x = Math.round(u.valToPos(xVal! + exemplars.xBucketSize!, 'x', true));
        let y = Math.round(u.valToPos(yVal + exemplars.yBucketSize!, 'y', true));
        ctx.beginPath();
        ctx.moveTo(x - 12, y + 2);
        ctx.lineTo(x - 2, y + 2);
        ctx.lineTo(x - 2, y + 12);
        ctx.lineTo(x - 12, y + 2);
        ctx.strokeStyle = theme.shadows.z1;
        ctx.fillStyle = theme.visualization.palette[Math.floor(colorBinSize * count - colorBinSize / 2)];
        ctx.fill();
        ctx.stroke();
      }
    });
  }
  ctx.save();
};
