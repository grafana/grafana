import { MutableDataFrame, Field } from '@grafana/data/src';
import { UPlotConfigBuilder } from '@grafana/ui/src';

import { getVisibleLabels, VisibleExemplarLabels } from './ExemplarsPlugin';

describe('getVisibleLabels()', () => {
  const dataFrameSeries1 = new MutableDataFrame({
    name: 'tns/app',
    fields: [
      {
        name: 'Time',
        values: [1670418750000, 1670418765000, 1670418780000, 1670418795000],
        entities: {},
      },
      {
        name: 'Value',
        labels: {
          job: 'tns/app',
        },
        values: [0.018963114754098367, 0.019140624999999974, 0.019718309859154928, 0.020064189189189167],
      },
    ] as unknown as Field[],
    length: 4,
  });
  const dataFrameSeries2 = new MutableDataFrame({
    name: 'tns/db',
    fields: [
      {
        name: 'Time',
        values: [1670418750000, 1670418765000, 1670418780000, 1670418795000],
        entities: {},
      },
      {
        name: 'Value',
        labels: {
          job: 'tns/db',
        },
        values: [0.028963114754098367, 0.029140624999999974, 0.029718309859154928, 0.030064189189189167],
      },
    ] as unknown as Field[],
    length: 4,
  });
  const dataFrameSeries3 = new MutableDataFrame({
    name: 'tns/loadgen',
    fields: [
      {
        name: 'Time',
        values: [1670418750000, 1670418765000, 1670418780000, 1670418795000],
        entities: {},
      },
      {
        name: 'Value',
        labels: {
          job: 'tns/loadgen',
        },
        values: [0.028963114754098367, 0.029140624999999974, 0.029718309859154928, 0.030064189189189167],
      },
    ] as unknown as Field[],
    length: 4,
  });
  const frames = [dataFrameSeries1, dataFrameSeries2, dataFrameSeries3];
  const config: UPlotConfigBuilder = {
    addHook: (type, hook) => {},
    series: [
      {
        props: {
          dataFrameFieldIndex: { frameIndex: 0, fieldIndex: 1 },
          show: true,
        },
      },
      {
        props: {
          dataFrameFieldIndex: { frameIndex: 1, fieldIndex: 1 },
          show: true,
        },
      },
      {
        props: {
          dataFrameFieldIndex: { frameIndex: 2, fieldIndex: 1 },
          show: false,
        },
      },
    ],
  } as UPlotConfigBuilder;

  it('function should only return labels associated with actively visible series', () => {
    const expected: VisibleExemplarLabels = {
      totalSeriesCount: 3,
      labels: [
        {
          color: '',
          labels: {
            job: 'tns/app',
          },
        },
        {
          color: '',
          labels: {
            job: 'tns/db',
          },
        },
      ],
    };

    // Base case
    expect(getVisibleLabels(config, [])).toEqual({ totalSeriesCount: 3, labels: [] });

    expect(getVisibleLabels(config, frames)).toEqual(expected);
  });
});
