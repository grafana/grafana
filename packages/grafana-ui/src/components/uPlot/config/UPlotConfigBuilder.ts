import { PlotSeriesConfig } from '../types';
import { ScaleProps, UPlotScaleBuilder } from './UPlotScaleBuilder';
import { SeriesProps, UPlotSeriesBuilder } from './UPlotSeriesBuilder';
import { AxisProps, UPlotAxisBuilder } from './UPlotAxisBuilder';
import { AxisPlacement } from '../config';
import { Cursor } from 'uplot';

export class UPlotConfigBuilder {
  private series: UPlotSeriesBuilder[] = [];
  private axes: Record<string, UPlotAxisBuilder> = {};
  private scales: UPlotScaleBuilder[] = [];
  private cursor: Cursor | undefined;

  hasLeftAxis = false;

  addAxis(props: AxisProps) {
    props.placement = props.placement ?? AxisPlacement.Auto;

    if (this.axes[props.scaleKey]) {
      this.axes[props.scaleKey].merge(props);
      return;
    }

    // Handle auto placement logic
    if (props.placement === AxisPlacement.Auto) {
      props.placement = this.hasLeftAxis ? AxisPlacement.Right : AxisPlacement.Left;
    }

    if (props.placement === AxisPlacement.Left) {
      this.hasLeftAxis = true;
    }

    if (props.placement === AxisPlacement.Hidden) {
      props.show = false;
      props.size = 0;
    }

    this.axes[props.scaleKey] = new UPlotAxisBuilder(props);
  }

  getAxisPlacement(scaleKey: string): AxisPlacement {
    const axis = this.axes[scaleKey];
    return axis?.props.placement! ?? AxisPlacement.Left;
  }

  setCursor(cursor?: Cursor) {
    this.cursor = cursor;
  }

  addSeries(props: SeriesProps) {
    this.series.push(new UPlotSeriesBuilder(props));
  }

  /** Add or update the scale with the scale key */
  addScale(props: ScaleProps) {
    const current = this.scales.find(v => v.props.scaleKey === props.scaleKey);
    if (current) {
      current.merge(props);
      return;
    }
    this.scales.push(new UPlotScaleBuilder(props));
  }

  getConfig() {
    const config: PlotSeriesConfig = { series: [{}] };
    config.axes = Object.values(this.axes).map(a => a.getConfig());
    config.series = [...config.series, ...this.series.map(s => s.getConfig())];
    config.scales = this.scales.reduce((acc, s) => {
      return { ...acc, ...s.getConfig() };
    }, {});
    if (this.cursor) {
      config.cursor = this.cursor;
    }
    return config;
  }
}
