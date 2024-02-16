import { FieldType } from '@grafana/data';

import { prepXYSeries } from './utils';

describe('when fill below to option is used', () => {
  let tests: any;

  beforeEach(() => {
    tests = [
      {
        panelOptions: {
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
                config: {
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
                },
                values: [1, 3],
                name: 'x',
                type: FieldType.number,
              },
              {
                config: {
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
                },
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
                config: {
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
                },
                values: [4, 6],
                name: 'w',
                type: FieldType.number,
              },
              {
                config: {
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
                },
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
                value: {},
              },
            },
            y: {
              field: {
                value: {},
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
      const series = prepXYSeries(test.panelOptions, test.frames);

      expect(series.color).toEqual(expectedResult.color);
      expect(series.size).toEqual(expectedResult.size);
    }
  });
});
