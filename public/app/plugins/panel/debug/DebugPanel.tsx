import { GaugeChart } from 'echarts/charts';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useLayoutEffect, useRef } from 'react';

import { PanelProps } from '@grafana/data';

import { Options } from './panelcfg.gen';

type Props = PanelProps<Options>;

echarts.use([GaugeChart, CanvasRenderer]);

export const DebugPanel = (props: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    let myChart = echarts.init(ref.current);
    let option = {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          center: ['50%', '75%'],
          radius: '90%',
          min: 0,
          max: 1,
          splitNumber: 8,
          axisLine: {
            lineStyle: {
              width: 6,
              color: [
                [0.25, '#FF6E76'],
                [0.5, '#FDDD60'],
                [0.75, '#58D9F9'],
                [1, '#7CFFB2'],
              ],
            },
          },
          pointer: {
            icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
            length: '12%',
            width: 20,
            offsetCenter: [0, '-60%'],
            itemStyle: {
              color: 'auto',
            },
          },
          axisTick: {
            length: 12,
            lineStyle: {
              color: 'auto',
              width: 2,
            },
          },
          splitLine: {
            length: 20,
            lineStyle: {
              color: 'auto',
              width: 5,
            },
          },
          axisLabel: {
            color: '#464646',
            fontSize: 20,
            distance: -60,
            rotate: 'tangential',
            formatter: function (value: number) {
              if (value === 0.875) {
                return 'Grade A';
              } else if (value === 0.625) {
                return 'Grade B';
              } else if (value === 0.375) {
                return 'Grade C';
              } else if (value === 0.125) {
                return 'Grade D';
              }
              return '';
            },
          },
          title: {
            offsetCenter: [0, '-10%'],
            fontSize: 20,
          },
          detail: {
            fontSize: 30,
            offsetCenter: [0, '-35%'],
            valueAnimation: true,
            formatter: function (value: number) {
              return Math.round(value * 100) + '';
            },
            color: 'inherit',
          },
          data: [
            {
              value: 0.7,
              name: 'Grade Rating',
            },
          ],
        },
      ],
    };

    myChart.setOption(option);
  }, []);

  return <div style={{ width: '100%', height: '100%' }} ref={ref}></div>;
};
