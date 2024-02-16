import { FieldType } from '@grafana/data';

import { prepXYSeries } from './utils';

describe('when fill below to option is used', () => {
  let tests: any;

  const manualConfig0 = {
    custom: {
      show: 'points',
      pointSize: {
        fixed: 5,
      },
      axisPlacement: 'auto',
      axisLabel: '',
      axisColorMode: 'text',
      axisBorderShow: false,
      scaleDistribution: {
        type: 'linear',
      },
      axisCenteredZero: false,
      hideFrom: {
        tooltip: false,
        viz: false,
        legend: false,
      },
    },
    color: {
      mode: 'palette-classic',
    },
    mappings: [],
    thresholds: {
      mode: 'absolute',
      steps: [
        {
          color: 'green',
          value: null,
        },
        {
          color: 'red',
          value: 80,
        },
      ],
    },
  };

  const manualConfig1 = {
    custom: {
      show: 'points',
      pointSize: {
        fixed: 5,
      },
      axisPlacement: 'auto',
      axisColorMode: 'text',
      axisBorderShow: false,
      axisCenteredZero: false,
      hideFrom: {
        tooltip: false,
        viz: false,
        legend: false,
      },
    },
    color: {
      mode: 'palette-classic',
    },
    thresholds: {
      mode: 'absolute',
      steps: [
        {
          color: 'green',
          value: null,
        },
        {
          color: 'red',
          value: 80,
        },
      ],
    },
  };

  beforeEach(() => {
    tests = [
      // manual mode test + multiple frames
      {
        options: {
          seriesMapping: 'manual',
          series: [
            {
              frame: {
                id: 'byIndex',
                options: 0,
              },
              x: {
                field: {
                  matcher: {
                    id: 'byName',
                    options: 'x',
                  },
                },
              },
              y: {
                field: {
                  matcher: {
                    id: 'byName',
                    options: 'y',
                  },
                },
              },
            },
            {
              frame: {
                id: 'byIndex',
                options: 1,
              },
              x: {
                field: {
                  matcher: {
                    id: 'byName',
                    options: 'w',
                  },
                },
              },
              y: {
                field: {
                  matcher: {
                    id: 'byName',
                    options: 'z',
                  },
                },
              },
            },
          ],
          tooltip: {
            mode: 'single',
            sort: 'none',
          },
          legend: {
            showLegend: true,
            displayMode: 'list',
            placement: 'bottom',
            calcs: [],
          },
        },
        frames: [
          {
            refId: 'A',
            fields: [
              {
                config: manualConfig0,
                values: [1, 3],
                name: 'x',
                type: FieldType.number,
              },
              {
                config: manualConfig0,
                values: [2, 4],
                name: 'y',
                type: FieldType.number,
              },
            ],
            length: 2,
          },
          {
            refId: 'A',
            fields: [
              {
                config: manualConfig0,
                values: [4, 6],
                name: 'w',
                type: FieldType.number,
              },
              {
                config: manualConfig0,
                values: [5, 7],
                name: 'z',
                type: FieldType.number,
              },
            ],
            length: 2,
          },
        ],
        expectedResult: [
          {
            color: {
              fixed: {
                value: '#73BF69',
              },
            },
            name: 'y',
            size: {
              fixed: {
                value: 5,
              },
            },
            x: {
              field: {
                value: {},
              },
            },
            y: {
              field: {
                value: {},
              },
            },
          },
          {
            color: {
              fixed: {
                value: '#F2CC0C',
              },
            },
            name: 'z',
            size: {
              fixed: {
                value: 5,
              },
            },
            x: {
              field: {
                value: {
                  config: manualConfig1,
                  values: [],
                  name: 'w',
                  type: FieldType.number,
                },
              },
            },
            y: {
              field: {
                value: {
                  config: manualConfig1,
                  values: [],
                  name: 'z',
                  type: FieldType.number,
                },
              },
            },
          },
        ],
      },
      // manual mode test + multiple frames
      {
        options: {
          seriesMapping: 'manual',
          series: [
            {
              frame: {
                id: 'byIndex',
                options: 0,
              },
              x: {
                field: {
                  matcher: {
                    id: 'byName',
                    options: 'humidity',
                  },
                },
              },
              y: {
                field: {
                  exclude: {
                    id: 'byNames',
                    options: ['co TLM0100'],
                  },
                  matcher: {
                    id: 'byName',
                    options: 'temperature',
                  },
                },
              },
            },
          ],
          tooltip: {
            mode: 'single',
            sort: 'none',
          },
          legend: {
            showLegend: true,
            displayMode: 'list',
            placement: 'bottom',
            calcs: [],
          },
          mapping: 'manual',
        },
        frames: [
          {
            refId: 'A',
            fields: [
              {
                config: manualConfig1,
                values: [],
                name: '_time',
                type: FieldType.time,
              },
              {
                config: manualConfig1,
                values: [],
                labels: { sensor_id: 'TLM0100' },
                name: 'co',
                type: FieldType.number,
              },
              {
                config: manualConfig1,
                values: [],
                labels: { sensor_id: 'TLM0100' },
                name: 'humidity',
                type: FieldType.number,
              },
              {
                config: manualConfig1,
                values: [],
                labels: { sensor_id: 'TLM0100' },
                name: 'temperature',
                type: FieldType.number,
              },
            ],
            length: 10,
          },
          {
            refId: 'A',
            fields: [
              {
                config: manualConfig1,
                values: [],
                name: '_time',
                type: FieldType.time,
              },
              {
                config: manualConfig1,
                values: [],
                labels: { sensor_id: 'TLM0101' },
                name: 'co',
                type: FieldType.number,
              },
              {
                config: manualConfig1,
                values: [],
                labels: { sensor_id: 'TLM0101' },
                name: 'humidity',
                type: FieldType.number,
              },
              {
                config: manualConfig1,
                values: [],
                labels: { sensor_id: 'TLM0101' },
                name: 'temperature',
                type: FieldType.number,
              },
            ],
            length: 10,
          },
          {
            refId: 'A',
            fields: [
              {
                config: manualConfig1,
                values: [],
                name: '_time',
                type: FieldType.time,
              },
              {
                config: manualConfig1,
                values: [],
                labels: { sensor_id: 'TLM0102' },
                name: 'co',
                type: FieldType.number,
              },
              {
                config: manualConfig1,
                values: [],
                labels: { sensor_id: 'TLM0102' },
                name: 'humidity',
                type: FieldType.number,
              },
              {
                config: manualConfig1,
                values: [],
                labels: { sensor_id: 'TLM0102' },
                name: 'temperature',
                type: FieldType.number,
              },
            ],
            length: 10,
          },
        ],
        expectedResult: [
          {
            color: {
              fixed: {
                value: '#73BF69',
              },
            },
            name: ' TLM0100',
            size: {
              fixed: {
                value: 5,
              },
            },
            x: {
              field: {
                value: {
                  config: manualConfig1,
                  values: [],
                  labels: { sensor_id: 'TLM0100' },
                  name: 'humidity',
                  type: FieldType.number,
                },
              },
            },
            y: {
              field: {
                value: {
                  config: manualConfig1,
                  values: [],
                  labels: { sensor_id: 'TLM0100' },
                  name: 'temperature',
                  type: FieldType.number,
                },
              },
            },
          },
        ],
      },
    ];
  });

  it('should verify if prepXYSeries is return correct series sctructure', () => {
    for (const test of tests) {
      const expectedResult = test.expectedResult;
      const series = prepXYSeries(test.options, test.frames);

      expect(series.color).toEqual(expectedResult.color);
      expect(series.size).toEqual(expectedResult.size);

      // expect(series.x.field.matcher.options).toEqual(expectedResult.x.field.matcher.options);
    }
  });
});
