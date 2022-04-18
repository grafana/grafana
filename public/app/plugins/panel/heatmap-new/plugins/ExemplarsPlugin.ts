import { GrafanaTheme2 } from '@grafana/data';
import { UPlotConfigBuilder } from '@grafana/ui';
import { HeatmapData } from '../fields';

interface ExemplarsPluginProps {
  u: uPlot;
  config: UPlotConfigBuilder;
  exemplars: HeatmapData;
  theme: GrafanaTheme2;
}

export const ExemplarsPlugin = ({ u, exemplars, config, theme }: ExemplarsPluginProps) => {
  console.log('theme', theme, 'u', u, 'config', config);
  const { ctx } = u;
  const xField: number[] | undefined = exemplars?.heatmap?.fields.find((f) => f.name === 'xMin')?.values.toArray();
  const yField: number[] | undefined = exemplars?.heatmap?.fields.find((f) => f.name === 'yMin')?.values.toArray();
  const countField: number[] | undefined = exemplars?.heatmap?.fields.find((f) => f.name === 'count')?.values.toArray();

  if (xField && yField && countField) {
    const max = Math.max(...countField);
    const colorBinSize = theme.visualization.palette.length / max;
    countField.forEach((count, i) => {
      const xVal = xField[i];
      const yVal = yField[i];
      if (count > 0) {
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
