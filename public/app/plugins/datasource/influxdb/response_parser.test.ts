import { size } from 'lodash';
import { of } from 'rxjs';

import { AnnotationEvent, DataFrame, DataQueryRequest, dateTime, FieldType, MutableDataFrame } from '@grafana/data';
import { FetchResponse } from '@grafana/runtime';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__

import InfluxQueryModel from './influx_query_model';
import { getMockDSInstanceSettings, getMockInfluxDS } from './mocks/datasource';
import ResponseParser, { getSelectedParams } from './response_parser';
import { InfluxQuery } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

describe('influxdb response parser', () => {
  const parser = new ResponseParser();

  describe('SHOW TAG response', () => {
    const query = 'SHOW TAG KEYS FROM "cpu"';
    const response = {
      results: [
        {
          series: [
            {
              name: 'cpu',
              columns: ['tagKey'],
              values: [['datacenter'], ['hostname'], ['source']],
            },
          ],
        },
      ],
    };

    const result = parser.parse(query, response);

    it('expects three results', () => {
      expect(size(result)).toBe(3);
    });
  });

  describe('SHOW TAG VALUES response', () => {
    const query = 'SHOW TAG VALUES FROM "cpu" WITH KEY = "hostname"';

    describe('response from 0.10.0', () => {
      const response = {
        results: [
          {
            series: [
              {
                name: 'hostnameTagValues',
                columns: ['hostname'],
                values: [['server1'], ['server2'], ['server2']],
              },
            ],
          },
        ],
      };

      const result = parser.parse(query, response);

      it('should get two responses', () => {
        expect(size(result)).toBe(2);
        expect(result[0].text).toBe('server1');
        expect(result[1].text).toBe('server2');
      });
    });

    describe('response from 0.12.0', () => {
      const response = {
        results: [
          {
            series: [
              {
                name: 'cpu',
                columns: ['key', 'value'],
                values: [
                  ['source', 'site'],
                  ['source', 'api'],
                ],
              },
              {
                name: 'logins',
                columns: ['key', 'value'],
                values: [
                  ['source', 'site'],
                  ['source', 'webapi'],
                ],
              },
            ],
          },
        ],
      };

      const result = parser.parse(query, response);

      it('should get two responses', () => {
        expect(size(result)).toBe(3);
        expect(result[0].text).toBe('site');
        expect(result[1].text).toBe('api');
        expect(result[2].text).toBe('webapi');
      });
    });
  });

  describe('SELECT response', () => {
    const query = 'SELECT "usage_iowait" FROM "cpu" LIMIT 10';
    const response = {
      results: [
        {
          series: [
            {
              name: 'cpu',
              columns: ['time', 'usage_iowait'],
              values: [
                [1488465190006040638, 0.0],
                [1488465190006040638, 15.0],
                [1488465190006040638, 20.2],
              ],
            },
          ],
        },
      ],
    };

    const result = parser.parse(query, response);

    it('should return second column', () => {
      expect(size(result)).toBe(3);
      expect(result[0].text).toBe('0');
      expect(result[1].text).toBe('15');
      expect(result[2].text).toBe('20.2');
    });
  });

  describe('SELECT response where ordering matters', () => {
    const query = 'SELECT "val" from "num"';
    const response = {
      results: [
        {
          series: [
            {
              name: 'num',
              columns: ['time', 'val'],
              values: [
                [1620041231000, 2],
                [1620041233000, 3],
                [1620041235000, 4],
                [1620041238000, 5],
                [1620041239000, 1],
              ],
            },
          ],
        },
      ],
    };

    it('should keep the order returned by influxdb, even for numbers', () => {
      expect(parser.parse(query, response)).toStrictEqual([
        { text: '2' },
        { text: '3' },
        { text: '4' },
        { text: '5' },
        { text: '1' },
      ]);
    });
  });

  describe('SHOW FIELD response', () => {
    const query = 'SHOW FIELD KEYS FROM "cpu"';

    describe('response from pre-1.0', () => {
      const response = {
        results: [
          {
            series: [
              {
                name: 'cpu',
                columns: ['fieldKey'],
                values: [['value']],
              },
            ],
          },
        ],
      };

      const result = parser.parse(query, response);

      it('should get two responses', () => {
        expect(size(result)).toBe(1);
      });
    });

    describe('response from 1.0', () => {
      const response = {
        results: [
          {
            series: [
              {
                name: 'cpu',
                columns: ['fieldKey', 'fieldType'],
                values: [['time', 'float']],
              },
            ],
          },
        ],
      };

      const result = parser.parse(query, response);

      it('should return first column', () => {
        expect(size(result)).toBe(1);
        expect(result[0].text).toBe('time');
      });
    });
  });

  describe('Should name the selected params correctly', () => {
    it('when there are no duplicates', () => {
      const query = new InfluxQueryModel({
        refId: 'A',
        select: [[{ type: 'field', params: ['usage_iowait'] }], [{ type: 'field', params: ['usage_idle'] }]],
      });

      const selectedParams = getSelectedParams(query.target);

      expect(selectedParams.length).toBe(2);
      expect(selectedParams[0]).toBe('usage_iowait');
      expect(selectedParams[1]).toBe('usage_idle');
    });

    it('when there are duplicates', () => {
      const query = new InfluxQueryModel({
        refId: 'A',
        select: [
          [{ type: 'field', params: ['usage_iowait'] }],
          [{ type: 'field', params: ['usage_iowait'] }],
          [{ type: 'field', params: ['usage_iowait'] }],
          [{ type: 'field', params: ['usage_idle'] }],
        ],
      });

      const selectedParams = getSelectedParams(query.target);

      expect(selectedParams.length).toBe(4);
      expect(selectedParams[0]).toBe('usage_iowait');
      expect(selectedParams[1]).toBe('usage_iowait_1');
      expect(selectedParams[2]).toBe('usage_iowait_2');
      expect(selectedParams[3]).toBe('usage_idle');
    });
  });

  describe('Should get the table', () => {
    const dataFrame = new MutableDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1640257340000] },
        { name: 'value', type: FieldType.number, values: [3234232323] },
      ],
      meta: {
        executedQueryString: 'SELECT everything!',
      },
    });

    const query = new InfluxQueryModel({
      refId: 'A',
      select: [[{ type: 'field', params: ['usage_iowait'] }], [{ type: 'field', params: ['usage_idle'] }]],
    });

    const table = parser.getTable([dataFrame], query.target, {
      preferredVisualisationType: 'table',
    });

    it('columns correctly', () => {
      expect(table.columns.length).toBe(3);
      expect(table.columns[0].text).toBe('Time');
      expect(table.columns[1].text).toBe('usage_iowait');
      expect(table.columns[2].text).toBe('usage_idle');
    });

    it('rows correctly', () => {
      expect(table.rows.length).toBe(1);
      expect(table.rows[0].length).toBe(2);
      expect(table.rows[0][0]).toBe(1640257340000);
      expect(table.rows[0][1]).toBe(3234232323);
    });

    it('preferredVisualisationType correctly', () => {
      expect(table.meta?.preferredVisualisationType).toBe('table');
    });

    it('executedQueryString correctly', () => {
      expect(table.meta?.executedQueryString).toBe('SELECT everything!');
    });
  });

  describe('table with aliases', () => {
    it('should parse the table with alias', () => {
      const table = parser.getTable(mockDataFramesWithAlias, mockQuery, { preferredVisualisationType: 'table' });
      expect(table.columns.length).toBe(4);
      expect(table.columns[0].text).toBe('Time');
      expect(table.columns[1].text).toBe('geohash');
      expect(table.columns[2].text).toBe('ALIAS1');
      expect(table.columns[3].text).toBe('ALIAS2');
    });

    it('should parse the table when there is no alias and two field selects', () => {
      const table = parser.getTable(mockDataframesWithTwoFieldSelect, mockQueryWithTwoFieldSelect, {
        preferredVisualisationType: 'table',
      });
      expect(table.columns.length).toBe(3);
      expect(table.columns[0].text).toBe('Time');
      expect(table.columns[1].text).toBe('mean');
      expect(table.columns[2].text).toBe('mean_1');
    });
  });

  describe('When issuing annotationQuery', () => {
    const ctx = {
      ds: getMockInfluxDS(getMockDSInstanceSettings()),
    };

    const fetchMock = jest.spyOn(backendSrv, 'fetch');

    const annotation: InfluxQuery = {
      refId: 'A',
      fromAnnotations: true,
      name: 'Anno',
      query: 'select * from logs where time >= now() - 15m and time <= now()',
      textColumn: 'textColumn',
      tagsColumn: 'host,path',
    };

    const queryOptions: DataQueryRequest = {
      app: 'explore',
      interval: '',
      intervalMs: 0,
      requestId: '',
      scopedVars: {},
      startTime: 0,
      timezone: '',
      targets: [annotation],
      range: {
        from: dateTime().subtract(1, 'h'),
        to: dateTime(),
        raw: { from: '1h', to: 'now' },
      },
    };
    let response: AnnotationEvent[];

    beforeEach(async () => {
      fetchMock.mockImplementation(() => {
        return of(annotationMockResponse);
      });

      config.featureToggles.influxdbBackendMigration = true;
      response = await ctx.ds.annotationEvents(queryOptions, annotation);
    });

    it('should return annotation list', () => {
      expect(response.length).toBe(2);
      expect(response[0].time).toBe(1645208701000);
      expect(response[0].title).toBe('Station softwareupdated[447]: Adding client 1');
      expect(response[0].text).toBe('text 1');
      expect(response[0].tags?.[0]).toBe('cbfa07e0e3bb 1');
      expect(response[0].tags?.[1]).toBe('/var/log/host/install.log 1');
      expect(response[1].time).toBe(1645208702000);
      expect(response[1].title).toBe('Station softwareupdated[447]: Adding client 2');
      expect(response[1].text).toBe('text 2');
      expect(response[1].tags?.[0]).toBe('cbfa07e0e3bb 2');
      expect(response[1].tags?.[1]).toBe('/var/log/host/install.log 2');
    });
  });
});

const mockQuery: InfluxQuery = {
  datasource: {
    type: 'influxdb',
    uid: '12345',
  },
  groupBy: [
    {
      params: ['$__interval'],
      type: 'time',
    },
    {
      type: 'tag',
      params: ['geohash::tag'],
    },
    {
      params: ['null'],
      type: 'fill',
    },
  ],
  measurement: 'cpu',
  orderByTime: 'ASC',
  policy: 'bar',
  refId: 'A',
  resultFormat: 'table',
  select: [
    [
      {
        type: 'field',
        params: ['value'],
      },
      {
        type: 'mean',
        params: [],
      },
      {
        type: 'alias',
        params: ['ALIAS1'],
      },
    ],
    [
      {
        type: 'field',
        params: ['value'],
      },
      {
        type: 'mean',
        params: [],
      },
      {
        type: 'alias',
        params: ['ALIAS2'],
      },
    ],
  ],
  tags: [],
};

const mockDataFramesWithAlias: DataFrame[] = [
  {
    name: 'cpu.ALIAS1 { geohash: tz6h548nc111 }',
    refId: 'A',
    meta: {
      executedQueryString:
        'SELECT mean("value") AS "ALIAS1", mean("value") AS "ALIAS2" FROM "bar"."cpu" WHERE time >= 1686582333244ms and time <= 1686583233244ms GROUP BY time(500ms), "geohash"::tag fill(null) ORDER BY time ASC',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1686582333000, 1686582333500, 1686582334000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          geohash: 'tz6h548nc111',
        },
        config: {
          displayNameFromDS: 'cpu.ALIAS1 { geohash: tz6h548nc111 }',
        },
        values: [null, 111.98024577663908, null],
      },
    ],
    length: 1801,
  },
  {
    name: 'cpu.ALIAS2 { geohash: tz6h548nc111 }',
    refId: 'A',
    meta: {
      executedQueryString:
        'SELECT mean("value") AS "ALIAS1", mean("value") AS "ALIAS2" FROM "bar"."cpu" WHERE time >= 1686582333244ms and time <= 1686583233244ms GROUP BY time(500ms), "geohash"::tag fill(null) ORDER BY time ASC',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1686582333000, 1686582333500, 1686582334000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          geohash: 'tz6h548nc111',
        },
        config: {
          displayNameFromDS: 'cpu.ALIAS2 { geohash: tz6h548nc111 }',
        },
        values: [null, 111.98024577663908, null],
      },
    ],
    length: 1801,
  },
  {
    name: 'cpu.ALIAS1 { geohash: wj7c61wnv111 }',
    refId: 'A',
    meta: {
      executedQueryString:
        'SELECT mean("value") AS "ALIAS1", mean("value") AS "ALIAS2" FROM "bar"."cpu" WHERE time >= 1686582333244ms and time <= 1686583233244ms GROUP BY time(500ms), "geohash"::tag fill(null) ORDER BY time ASC',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1686582333000, 1686582333500, 1686582334000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          geohash: 'wj7c61wnv111',
        },
        config: {
          displayNameFromDS: 'cpu.ALIAS1 { geohash: wj7c61wnv111 }',
        },
        values: [null, 112.97136059147347, null],
      },
    ],
    length: 1801,
  },
  {
    name: 'cpu.ALIAS2 { geohash: wj7c61wnv111 }',
    refId: 'A',
    meta: {
      executedQueryString:
        'SELECT mean("value") AS "ALIAS1", mean("value") AS "ALIAS2" FROM "bar"."cpu" WHERE time >= 1686582333244ms and time <= 1686583233244ms GROUP BY time(500ms), "geohash"::tag fill(null) ORDER BY time ASC',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1686582333000, 1686582333500, 1686582334000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          geohash: 'wj7c61wnv111',
        },
        config: {
          displayNameFromDS: 'cpu.ALIAS2 { geohash: wj7c61wnv111 }',
        },
        values: [null, 112.97136059147347, null],
      },
    ],
    length: 1801,
  },
  {
    name: 'cpu.ALIAS1 { geohash: wr50zpuhj111 }',
    refId: 'A',
    meta: {
      executedQueryString:
        'SELECT mean("value") AS "ALIAS1", mean("value") AS "ALIAS2" FROM "bar"."cpu" WHERE time >= 1686582333244ms and time <= 1686583233244ms GROUP BY time(500ms), "geohash"::tag fill(null) ORDER BY time ASC',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1686582333000, 1686582333500, 1686582334000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          geohash: 'wr50zpuhj111',
        },
        config: {
          displayNameFromDS: 'cpu.ALIAS1 { geohash: wr50zpuhj111 }',
        },
        values: [null, 112.27638560052755, null],
      },
    ],
    length: 1801,
  },
  {
    name: 'cpu.ALIAS2 { geohash: wr50zpuhj111 }',
    refId: 'A',
    meta: {
      executedQueryString:
        'SELECT mean("value") AS "ALIAS1", mean("value") AS "ALIAS2" FROM "bar"."cpu" WHERE time >= 1686582333244ms and time <= 1686583233244ms GROUP BY time(500ms), "geohash"::tag fill(null) ORDER BY time ASC',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1686582333000, 1686582333500, 1686582334000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          geohash: 'wr50zpuhj111',
        },
        config: {
          displayNameFromDS: 'cpu.ALIAS2 { geohash: wr50zpuhj111 }',
        },
        values: [null, 112.27638560052755, null],
      },
    ],
    length: 1801,
  },
];

const mockDataframesWithTwoFieldSelect: DataFrame[] = [
  {
    name: 'cpu.mean',
    refId: 'A',
    meta: {
      typeVersion: [0, 0],
      executedQueryString:
        'SELECT mean("value"), mean("value") FROM "bar"."cpu" WHERE time >= 1686585763070ms and time <= 1686585793070ms GROUP BY time(10ms) fill(null) ORDER BY time ASC',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1686585763070, 1686585763080, 1686585763090],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {
          displayNameFromDS: 'cpu.mean',
        },
        values: [null, 87.42703187930438, null],
      },
    ],
    length: 3,
  },
  {
    name: 'cpu.mean_1',
    refId: 'A',
    meta: {
      typeVersion: [0, 0],
      executedQueryString:
        'SELECT mean("value"), mean("value") FROM "bar"."cpu" WHERE time >= 1686585763070ms and time <= 1686585793070ms GROUP BY time(10ms) fill(null) ORDER BY time ASC',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1686585763070, 1686585763080, 1686585763090],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {
          displayNameFromDS: 'cpu.mean_1',
        },
        values: [87.3, 87.4, 87.5],
      },
    ],
    length: 3,
  },
];

const mockQueryWithTwoFieldSelect: InfluxQuery = {
  datasource: {
    type: 'influxdb',
    uid: '1234',
  },
  groupBy: [
    {
      params: ['$__interval'],
      type: 'time',
    },
    {
      params: ['null'],
      type: 'fill',
    },
  ],
  measurement: 'cpu',
  orderByTime: 'ASC',
  policy: 'bar',
  refId: 'A',
  resultFormat: 'table',
  select: [
    [
      {
        type: 'field',
        params: ['value'],
      },
      {
        type: 'mean',
        params: [],
      },
    ],
    [
      {
        type: 'field',
        params: ['value'],
      },
      {
        type: 'mean',
        params: [],
      },
    ],
  ],
  tags: [],
};

const annotationMockResponse: FetchResponse = {
  config: { url: '' },
  headers: new Headers(),
  ok: false,
  redirected: false,
  status: 0,
  statusText: '',
  type: 'basic',
  url: '',
  data: {
    results: {
      metricFindQuery: {
        frames: [
          {
            schema: {
              name: 'logs.host',
              fields: [
                {
                  name: 'time',
                  type: 'time',
                },
                {
                  name: 'value',
                  type: 'string',
                },
              ],
            },
            data: {
              values: [
                [1645208701000, 1645208702000],
                ['cbfa07e0e3bb 1', 'cbfa07e0e3bb 2'],
              ],
            },
          },
          {
            schema: {
              name: 'logs.message',
              fields: [
                {
                  name: 'time',
                  type: 'time',
                },
                {
                  name: 'value',
                  type: 'string',
                },
              ],
            },
            data: {
              values: [
                [1645208701000, 1645208702000],
                ['Station softwareupdated[447]: Adding client 1', 'Station softwareupdated[447]: Adding client 2'],
              ],
            },
          },
          {
            schema: {
              name: 'logs.path',
              fields: [
                {
                  name: 'time',
                  type: 'time',
                },
                {
                  name: 'value',
                  type: 'string',
                },
              ],
            },
            data: {
              values: [
                [1645208701000, 1645208702000],
                ['/var/log/host/install.log 1', '/var/log/host/install.log 2'],
              ],
            },
          },
          {
            schema: {
              name: 'textColumn',
              fields: [
                {
                  name: 'time',
                  type: 'time',
                },
                {
                  name: 'value',
                  type: 'string',
                },
              ],
            },
            data: {
              values: [
                [1645208701000, 1645208702000],
                ['text 1', 'text 2'],
              ],
            },
          },
        ],
      },
    },
  },
};
