import React, { PureComponent } from 'react';

import {
  DataFrame,
  getTimeField,
  FieldType,
  getFieldDisplayName,
  KeyValue,
  formattedValueToString,
  TimeRange,
  TimeZone,
  RawTimeRange,
  rangeUtil,
} from '@grafana/data';

import uPlot from 'uplot';
import { colors } from '../../utils';
import { Themeable } from '../../types';
import { GraphCustomFieldConfig } from './types';

interface Props extends Themeable {
  data: DataFrame; // assume applyFieldOverrides has been set
  width: number;
  height: number;

  timeRange: TimeRange; // NOTE: we should aim to make `time` a property of the axis, not force it for all graphs
  timeZone?: TimeZone; // NOTE: we should aim to make `time` a property of the axis, not force it for all graphs
}

interface State {
  // ?? over info?
}

export class MicroPlot extends PureComponent<Props, State> {
  plot?: uPlot;

  componentDidUpdate(oldProps: Props) {
    const { width, height } = this.props;
    if (!this.plot) {
      console.log('NO plot yet...');
      return;
    }

    // Update if the data changes
    if (this.props.data !== oldProps.data) {
      const { uData } = getUPlotStuff(this.props, [0, 1]);
      this.plot.setData(uData);
      // console.log('DATA changed!', uData, series);
      // Assume same structure?? this.plot.setSeries(series);
    }

    if (width !== oldProps.width || height !== oldProps.height) {
      this.plot.setSize({ width, height });
    }
  }

  renderLoop = () => {
    if (!this.plot) {
      return;
    }
    this.plot.redraw(true);

    setTimeout(() => {
      requestAnimationFrame(this.renderLoop);
    }, 50);
  };

  getTimeRange = (u: uPlot, min: number, max: number) => {
    return rangeToMinMax(this.props.timeRange.raw);
  };

  init = (element: any) => {
    const { width, height } = this.props;
    //  const tz = getTimeZoneInfo(timeZone || InternalTimeZones.localBrowserTime, Date.now());

    const { series, uData, scales, axes } = getUPlotStuff(this.props, this.getTimeRange);

    const opts: uPlot.Options = {
      width,
      height,
      legend: {
        show: false,
      },
      tzDate: ts => new Date(ts * 1000), //uPlot.tzDate(new Date(ts * 1000), tz!.abbreviation),
      scales,
      series,
      axes,
      hooks: {
        init: [
          u => {
            u.ctx.canvas.ondblclick = (e: any) => {
              console.log('Double click!', e);
            };

            const plot = u.root.querySelector('.over');
            if (!plot) {
              return;
            }

            plot.addEventListener('mouseleave', () => {
              console.log('EXIT');
            });

            plot.addEventListener('mouseenter', () => {
              console.log('ENTER');
            });
          },
        ],
        setSelect: [
          u => {
            const min = u.posToVal(u.select.left, 'x');
            const max = u.posToVal(u.select.left + u.select.width, 'x');
            console.log('SELECT', { min, max }, u.select, u);
          },
        ],
        setCursor: [
          u => {
            const { left, top, idx } = u.cursor;
            if (idx) {
              // const x = u.data[0][idx];
              // const y = u.data[1][idx];
              console.log('CURSOR', { left, top, idx });
            }
          },
        ],
      },
      // plugins: [
      //   // List the plugins
      //   renderPlugin({ spikes: 6 }),
      // ],
    };

    // Should only happen once!
    console.log('INIT Plot', series, scales, uData);
    this.plot = new uPlot(opts, uData, element);

    // keep drawing
    this.renderLoop();
  };

  render() {
    return (
      <div>
        <div ref={this.init} />
      </div>
    );
  }
}

const defaultFieldConfig: Partial<GraphCustomFieldConfig> = {
  showLines: true,
  lineWidth: 1,
  limeMode: 'connect',

  showPoints: false,
  pointRadius: 3,

  showBars: false,

  fillAlpha: 0,

  showAxis: true,
  axisWidth: 0, // Auto?
};

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

function rangeToMinMax(timeRange: RawTimeRange) {
  const v = rangeUtil.convertRawToRange(timeRange);
  return [v.from.valueOf() / 1000, v.to.valueOf() / 1000];
}

export function getUPlotStuff(props: Props, range: any) {
  const { data, theme } = props;

  const series: uPlot.Series[] = [];
  const uData: any[] = [];
  const scales: KeyValue<uPlot.Scale> = {
    x: {
      time: true,
      range: range as uPlot.MinMax, // uPlot.MinMax
    },
  };

  let { timeIndex } = getTimeField(data);
  if (isNaN(timeIndex!)) {
    timeIndex = 0; // not really time, but just a value
    scales.x.time = false;
  }
  let xvals = data.fields[timeIndex!].values.toArray();
  if (scales.x.time) {
    xvals = xvals.map(v => v / 1000); // Convert to second precision timestamp
  }
  uData.push(xvals); // make all numbers floating point
  series.push({});

  const axes: uPlot.Axis[] = [
    {
      // TIME Index
      show: true,
      stroke: theme.colors.text, // X axis
      grid: {
        show: true,
        stroke: theme.palette.gray1, // X grid lines
        width: 1 / devicePixelRatio,
      },
    },
  ];

  let sidx = 0;
  for (let i = 0; i < data.fields.length; i++) {
    if (i === timeIndex) {
      continue; // already handled time
    }
    const field = data.fields[i];
    if (field.type !== FieldType.number) {
      continue; // only numbers for now...
    }

    const fmt = field.display ?? defaultFormatter;
    const meta: GraphCustomFieldConfig = {
      ...defaultFieldConfig, // defaults
      ...field.config.custom, // field settings
    };

    const sid = field.config.unit || '__fixed';
    if (!scales[sid]) {
      const isRight = axes.length > 1;

      scales[sid] = {}; // anything?
      axes.push({
        scale: sid,
        show: meta.showAxis,
        size: meta.axisWidth || 80, //
        stroke: theme.colors.text,
        side: isRight ? 1 : 3,
        label: meta.axisLabel,
        values: (u, vals, space) => vals.map(v => formattedValueToString(fmt(v))),
        grid: {
          show: !isRight,
          stroke: theme.palette.gray1, // X grid lines
          width: 1 / devicePixelRatio,
        },
        //values: ()
      });
    }

    let color = colors[sidx++];

    series.push({
      label: getFieldDisplayName(field, data),
      stroke: color, // The line color

      scale: sid, // lookup to the scale
      value: (u, v) => formattedValueToString(fmt(v)),

      fill: meta.fillAlpha ? color : undefined,

      width: meta.showLines ? meta.lineWidth / devicePixelRatio : 0, // lines
    });

    uData.push(field.values.toArray());
  }

  return { series, uData, scales, axes };
}
