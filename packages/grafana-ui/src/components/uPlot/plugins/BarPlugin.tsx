import { isNumber, isString } from 'lodash';
import { useEffect } from 'react';
import uPlot from 'uplot';
import { usePlotPluginContext } from '../context';
import { PlotPluginProps } from '../types';

interface BarChartPluginProps extends PlotPluginProps {}

export const BarChartPlugin: React.FC<BarChartPluginProps> = ({ id }) => {
  const pluginId = `BarChartPlugin:${id}`;
  const pluginsApi = usePlotPluginContext();

  useEffect(
    () =>
      pluginsApi.registerPlugin({
        id: pluginId,
        hooks: {},
        opts: (self: uPlot, opts: uPlot.Options) => {
          opts.series = opts.series.map((serie, index) => {
            if (index === 0) {
              return serie;
            }

            return uPlot.assign(serie, {
              width: 0,
              paths: drawBars,
              points: {
                show: drawPoints,
              },
            });
          });
        },
      }),
    []
  );

  return null;
};

const barWidth = Math.round(20 * devicePixelRatio);

type ElementDrawer = (index: number, x0: number, y0: number, offset: number, totalWidth: number) => void;

const drawElements = (self: uPlot, seriesIdx: number, i0: number, i1: number, draw: ElementDrawer) => {
  const ySerie = self.series[seriesIdx];
  const xSerie = self.series[0];
  const xData = self.data[0];
  const yData = self.data[seriesIdx];
  const scaleX = xSerie.scale ?? 'x';
  const scaleY = ySerie.scale ?? 'y';

  const totalWidth = (self.series.length - 1) * barWidth;
  const offset = (seriesIdx - 1) * barWidth;

  for (let i = i0; i < i1; i++) {
    const xValue = xData[i];
    const yValue = yData[i];

    if (!isNumber(xValue) || !isNumber(yValue)) {
      continue;
    }

    let x0 = Math.round(self.valToPos(xValue, scaleX, true));
    let y0 = Math.round(self.valToPos(yValue, scaleY, true));

    draw(i, x0, y0, offset, totalWidth);
  }
};

const drawBars = () => {};

const drawPoints = (self: uPlot, seriesIdx: number, i0: number, i1: number) => {
  const drawer = (index: number, x0: number, y0: number, offset: number, totalWidth: number) => {
    const value = self.data[seriesIdx][index];
    if (!isNumber(value) && !isString(value)) {
      return;
    }
    self.ctx.fillText(value.toString(), x0 - totalWidth / 2 + offset + barWidth / 2, y0);
  };

  drawElements(self, seriesIdx, i0, i1, drawer);
};
