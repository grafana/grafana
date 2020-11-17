import tinycolor from 'tinycolor2';
import uPlot from 'uplot';
import { AxisProps, ScaleProps, SeriesProps } from '../uPlot/geometries/types';
import { calculateAxisSize, calculateSpace, formatTime } from '../uPlot/utils';
import { PlotSeriesConfig } from '../uPlot/types';

abstract class UPlotConfigBuilder<P, T> {
  constructor(protected props: P) {}
  abstract getConfig(): T;
}

export class GraphConfigBuilder {
  private series: GraphSeriesBuilder[] = [];
  private axes: GraphAxisBuilder[] = [];
  private scales: GraphScaleBuilder[] = [];

  addAxis(props: AxisProps) {
    this.axes.push(new GraphAxisBuilder(props));
  }

  addSeries(props: SeriesProps) {
    this.series.push(new GraphSeriesBuilder(props));
  }

  addScale(props: ScaleProps) {
    this.scales.push(new GraphScaleBuilder(props));
  }

  getConfig() {
    const config: PlotSeriesConfig = { series: [{}] };
    config.axes = this.axes.map(a => a.getConfig());
    config.series = [...config.series, ...this.series.map(s => s.getConfig())];
    config.scales = this.scales.reduce((acc, s) => {
      return { ...acc, ...s.getConfig() };
    }, {});

    return config;
  }
}

class GraphAxisBuilder extends UPlotConfigBuilder<AxisProps, uPlot.Axis> {
  getConfig(): uPlot.Axis {
    const {
      scaleKey,
      label,
      show = true,
      side = 3,
      grid = true,
      formatValue,
      values,
      isTime,
      timeZone,
      theme,
    } = this.props;
    const stroke = this.props.stroke || theme.colors.text;
    const gridColor = theme.isDark ? theme.palette.gray25 : theme.palette.gray90;

    let config: uPlot.Axis = {
      scale: scaleKey,
      label,
      show,
      stroke,
      side,
      font: '12px Roboto',
      size: calculateAxisSize,
      grid: {
        show: grid,
        stroke: gridColor,
        width: 1 / devicePixelRatio,
      },
      ticks: {
        show: true,
        stroke: gridColor,
        width: 1 / devicePixelRatio,
      },
      values: values,
      space: calculateSpace,
    };

    if (values) {
      config.values = values;
    } else if (isTime) {
      config.values = formatTime;
    } else if (formatValue) {
      config.values = (u: uPlot, vals: any[]) => vals.map(v => formatValue(v));
    }

    // store timezone
    (config as any).timeZone = timeZone;

    return config;
  }
}

class GraphScaleBuilder extends UPlotConfigBuilder<ScaleProps, uPlot.Scale> {
  getConfig() {
    const { isTime, scaleKey } = this.props;
    return {
      [scaleKey]: {
        time: !!isTime,
      },
    };
  }
}

class GraphSeriesBuilder extends UPlotConfigBuilder<SeriesProps, uPlot.Series> {
  getConfig() {
    const { line, lineColor, lineWidth, points, pointColor, pointSize, fillColor, fillOpacity, scaleKey } = this.props;

    const lineConfig = line
      ? {
          stroke: lineColor,
          width: lineWidth,
        }
      : {};

    const pointsConfig = points
      ? {
          points: {
            show: true,
            size: pointSize,
            stroke: pointColor,
          },
        }
      : {};

    const areaConfig =
      fillOpacity !== undefined
        ? {
            fill: tinycolor(fillColor)
              .setAlpha(fillOpacity)
              .toRgbString(),
          }
        : { fill: undefined };

    return {
      scale: scaleKey,
      ...lineConfig,
      ...pointsConfig,
      ...areaConfig,
    };
  }
}
