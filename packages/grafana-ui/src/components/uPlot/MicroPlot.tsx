import React, { PureComponent } from 'react';

import { DataFrame, getTimeField, FieldType } from '@grafana/data';

import uPlot from 'uplot';
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

    const { series, uData, scales } = getUPlotStuff(this.props);

    const opts = {
      width,
      height,
      legend: {
        show: false,
      },
      tzDate: (ts: any) => uPlot.tzDate(new Date(ts * 1000), 'Etc/UTC'),
      scales,
      series,
      axes: [
        {
          show: true,
          stroke: 'red',
          grid: {
            show: true,
            stroke: 'green',
            width: 1,
          },
        },
        {
          show: true,
          label: 'Population',
          labelSize: 30,
          labelFont: 'bold 12px Arial',
          font: '12px Arial',
          gap: 5,
          size: 50,
          stroke: 'red',
          grid: {
            show: true,
            stroke: '#eee',
            width: 1,
          },
          ticks: {
            show: true,
            stroke: 'pink',
            width: 2,
          },
          //  values: (u: any, vals: any) => vals.map((v: any) => fmtt(v, 0)),
        },
        {
          show: true,
          label: 'Right Axis AAA',
          labelSize: 30,
          labelFont: 'bold 12px Arial',
          font: '12px Arial',
          gap: 5,
          size: 50,
          stroke: 'red',
          side: 1,
        },
        {
          show: true,
          label: 'Right Axis BBB',
          labelSize: 30,
          labelFont: 'bold 12px Arial',
          font: '12px Arial',
          gap: 5,
          size: 50,
          stroke: 'red',
          side: 1,
        },
        {
          show: true,
          label: 'Right Axis CCC',
          labelSize: 30,
          labelFont: 'bold 12px Arial',
          font: '12px Arial',
          gap: 5,
          size: 50,
          stroke: 'red',
          side: 1,
        },
        {
          show: true,
          label: 'Left axis',
          labelSize: 30,
          labelFont: 'bold 12px Arial',
          font: '12px Arial',
          gap: 5,
          size: 50,
          stroke: 'red',
          side: 3,
        },
      ],
      hooks: {
        init: [
          (u: any) => {
            u.ctx.canvas.ondblclick = (e: any) => {
              console.log('Double click!', e);
            };

            const plot = u.root.querySelector('.over');

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
    console.log('INIT Plot', series, scales, uData);
    this.plot = new uPlot(opts, uData, element);
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
  const scales: any = {
    x: {
      time: true,
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

  let sidx = 0;
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
      stroke: colors[sidx++], // The line color
      //fill: 'red',
      width: 1,
    });
    uData.push(field.values.toArray());
  }

  return { series, uData, scales };
}
