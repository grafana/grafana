import React from 'react';
import { GrafanaTheme } from '@grafana/data';
import { UPlotConfigBuilder, useStyles } from '@grafana/ui';
import { HeatmapData } from '../fields';

interface ExemplarsPluginProps {
  config: UPlotConfigBuilder;
  exemplars: HeatmapData;
  colorPalette: string[];
}

const getStyles = (theme: GrafanaTheme) => {
  return theme;
};

export const ExemplarsPlugin = ({ exemplars, config, colorPalette }: ExemplarsPluginProps) => {
  const styles = useStyles(getStyles);
  config.addHook('draw', (u: uPlot) => {
    const { ctx } = u;
    const xField: number[] | undefined = exemplars?.heatmap?.fields.find((f) => f.name === 'xMin')?.values.toArray();
    const yField: number[] | undefined = exemplars?.heatmap?.fields.find((f) => f.name === 'yMin')?.values.toArray();
    const countField: number[] | undefined = exemplars?.heatmap?.fields
      .find((f) => f.name === 'count')
      ?.values.toArray();

    if (xField && yField && countField) {
      const max = Math.max(...countField);
      const colorBinSize = colorPalette.length / max;
      countField.forEach((count, i) => {
        const xVal = xField[i];
        const yVal = yField[i];
        if (count > 0) {
          let x = Math.round(u.valToPos(xVal! + exemplars.xBucketSize!, 'x', true));
          let y = Math.round(u.valToPos(yVal + exemplars.yBucketSize!, 'y', true));
          ctx.beginPath();
          ctx.moveTo(x - 12, y + 3);
          ctx.lineTo(x - 2, y + 3);
          ctx.lineTo(x - 2, y + 13);
          ctx.lineTo(x - 12, y + 3);
          ctx.strokeStyle = styles.palette.dark1;
          ctx.fillStyle = colorPalette[Math.floor(colorBinSize * count - colorBinSize / 2)];
          ctx.fill();
          ctx.stroke();
        }
      });
    }
    ctx.save();
  });

  return <></>;
};
