import React, { PureComponent } from 'react';

import { DataFrame, getTimeField, FieldType, formattedValueToString } from '@grafana/data';

import uPlot from 'uPlot/dist/uPlot.cjs';
// import 'uPlot/src/uPlot.css';
import { colors } from '../../utils';

interface Props {
  data: DataFrame; // assume applyFieldOverrides has been set
  width: number;
  height: number;
}

interface PlotState {
  // ?? over info?
}

export class MicroPlot extends PureComponent<Props, PlotState> {
  plot: any;

  componentDidUpdate(oldProps: Props) {
    const { width, height } = this.props;
    if (!this.plot) {
      console.log('NO plot yet...');
      return;
    }

    // Update if the data changes
    if (this.props.data !== oldProps.data) {
      const { series, uData } = getUPlotStuff(this.props);
      this.plot.setData(uData);
      console.log('DATA changed!', uData, series);
      // Assume same structure?? this.plot.setSeries(series);
    }

    if (width !== oldProps.width || height !== oldProps.height) {
      this.plot.setSize({ width, height });
    }
  }

  init = (element: any) => {
    const { width, height } = this.props;

    const { series, uData } = getUPlotStuff(this.props);
    const fmtt = (val: number, dec: number) => val.toFixed(dec);

    const opts = {
      width,
      height,
      legend: {
        show: false,
      },
      tzDate: (ts: any) => uPlot.tzDate(new Date(ts), 'Etc/UTC'),
      scales: {
        x: {
          distr: 2,
        },
      },
      series,
      axes: [
        {},
        {
          values: (u: any, vals: any) => vals.map((v: any) => fmtt(v, 0)),
        },
      ],
      hooks: {
        init: [
          (u: any) => {
            u.ctx.canvas.ondblclick = (e: any) => {
              console.log('Double click!', e);
            };

            const plot = u.root.querySelector('.plot');

            plot.addEventListener('mouseleave', () => {
              console.log('EXIT');
            });

            plot.addEventListener('mouseenter', () => {
              console.log('ENTER');
            });
          },
        ],
        setSelect: [
          (u: any) => {
            const min = u.posToVal(u.select.left, 'x');
            const max = u.posToVal(u.select.left + u.select.width, 'x');
            console.log('SELECT', { min, max }, u.select, u);
          },
        ],
        setCursor: [
          (u: any) => {
            const { left, top, idx } = u.cursor;
            const x = u.data[0][idx];
            const y = u.data[1][idx];
            console.log('CURSOR', { x, y, left, top });
          },
        ],
      },
    };

    // Should only happen once!
    console.log('INIT Plot', series, uData);
    this.plot = new uPlot.Line(opts, uData, element);
  };

  render() {
    return (
      <div>
        <div ref={this.init} />
      </div>
    );
  }
}

export function getUPlotStuff(props: Props) {
  const { data } = props;
  const series: any[] = [];
  const uData: any[] = [];
  let { timeIndex } = getTimeField(data);
  if (!timeIndex) {
    timeIndex = 0;
  }

  series.push({});
  uData.push(data.fields[timeIndex].values.toArray());
  for (let i = 0; i < data.fields.length; i++) {
    if (i === timeIndex) {
      continue; // already handled time
    }
    const field = data.fields[i];
    if (field.type !== FieldType.number) {
      continue; // only numbers for now...
    }

    series.push({
      label: field.name,
      stroke: colors[i], // The line color
    });
    uData.push(field.values.toArray());
  }
  return { series, uData };
}
