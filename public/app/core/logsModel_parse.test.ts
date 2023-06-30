import { DataFrame, FieldType, dateTimeFormatISO, DateTimeInput, DateTimeOptions } from '@grafana/data';

import { logSeriesToLogsModel } from './logsModel';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  // this produces relative time, so the test-results would keep changing,
  // so we have to mock it
  dateTimeFormatTimeAgo: (p1: DateTimeInput, p2?: DateTimeOptions) =>
    `mock:dateTimeFormatTimeAgo:${dateTimeFormatISO(p1, p2)}`,
}));

describe('logSeriesToLogsModel should parse different logs-dataframe formats', () => {
  it('should parse old Loki-style (grafana8.x) frames ( multi-frame )', () => {
    const frames: DataFrame[] = [
      {
        meta: {},
        refId: 'A',
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
            config: { displayName: 'Time' },
            values: ['2023-06-07T12:18:36.839Z'],
          },
          {
            name: 'line',
            type: FieldType.string,
            config: {},
            values: ['line1'],
            labels: {
              counter: '34543',
              label: 'val3',
              level: 'info',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: ['id1'],
          },
          {
            name: 'tsNs',
            type: FieldType.time,
            config: { displayName: 'Time ns' },
            values: ['1686140316839544212'],
          },
        ],
        length: 1,
      },
      {
        meta: {},
        refId: 'A',
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
            config: { displayName: 'Time' },
            values: ['2023-06-07T12:18:34.632Z'],
          },
          {
            name: 'line',
            type: FieldType.string,
            config: {},
            values: ['line2'],
            labels: {
              counter: '34540',
              label: 'val3',
              level: 'error',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: ['id2'],
          },
          {
            name: 'tsNs',
            type: FieldType.time,
            config: { displayName: 'Time ns' },
            values: ['1686140314632163066'],
          },
        ],
        length: 1,
      },
      {
        meta: {},
        refId: 'A',
        fields: [
          {
            name: 'ts',
            type: FieldType.time,
            config: { displayName: 'Time' },
            values: ['2023-06-07T12:18:35.565Z'],
          },
          {
            name: 'line',
            type: FieldType.string,
            config: {},
            values: ['line3'],
            labels: {
              counter: '34541',
              label: 'val3',
              level: 'error',
            },
          },
          {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: ['id3'],
          },
          {
            name: 'tsNs',
            type: FieldType.time,
            config: { displayName: 'Time ns' },
            values: ['1686140315565682856'],
          },
        ],
        length: 1,
      },
    ];

    const expected = {
      hasUniqueLabels: true,
      meta: [
        {
          kind: 2,
          label: 'Common labels',
          value: {
            label: 'val3',
          },
        },
      ],
      rows: [
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line1',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {
            counter: '34543',
            label: 'val3',
            level: 'info',
          },
          logLevel: 'info',
          raw: 'line1',
          rowIndex: 0,
          searchWords: [],
          timeEpochMs: 1686140316839,
          timeEpochNs: '1686140316839544212',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:18:36-06:00',
          timeLocal: '2023-06-07 06:18:36',
          timeUtc: '2023-06-07 12:18:36',
          uid: 'A_id1',
          uniqueLabels: {
            counter: '34543',
            level: 'info',
          },
        },
        {
          dataFrame: frames[1],
          datasourceType: undefined,
          entry: 'line2',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {
            counter: '34540',
            label: 'val3',
            level: 'error',
          },
          logLevel: 'error',
          raw: 'line2',
          rowIndex: 0,
          searchWords: [],
          timeEpochMs: 1686140314632,
          timeEpochNs: '1686140314632163066',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:18:34-06:00',
          timeLocal: '2023-06-07 06:18:34',
          timeUtc: '2023-06-07 12:18:34',
          uid: 'A_id2',
          uniqueLabels: {
            counter: '34540',
            level: 'error',
          },
        },
        {
          dataFrame: frames[2],
          datasourceType: undefined,
          entry: 'line3',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {
            counter: '34541',
            label: 'val3',
            level: 'error',
          },
          logLevel: 'error',
          raw: 'line3',
          rowIndex: 0,
          searchWords: [],
          timeEpochMs: 1686140315565,
          timeEpochNs: '1686140315565682856',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:18:35-06:00',
          timeLocal: '2023-06-07 06:18:35',
          timeUtc: '2023-06-07 12:18:35',
          uid: 'A_id3',
          uniqueLabels: {
            counter: '34541',
            level: 'error',
          },
        },
      ],
    };

    expect(logSeriesToLogsModel(frames)).toStrictEqual(expected);
  });

  it('should parse a Loki-style frame (single-frame, labels-in-json)', () => {
    const frames: DataFrame[] = [
      {
        refId: 'A',
        fields: [
          {
            name: 'labels',
            type: FieldType.other,
            config: {},
            values: [
              {
                counter: '38141',
                label: 'val2',
                level: 'warning',
              },
              {
                counter: '38143',
                label: 'val2',
                level: 'info',
              },
              {
                counter: '38142',
                label: 'val3',
                level: 'info',
              },
            ],
          },
          {
            name: 'Time',
            type: FieldType.time,
            config: {},
            values: [1686142519756, 1686142520411, 1686142519997],
            nanos: [641000, 0, 0],
          },
          {
            name: 'Line',
            type: FieldType.string,
            config: {},
            values: ['line1', 'line2', 'line3'],
          },
          {
            name: 'tsNs',
            type: FieldType.string,
            config: {},
            values: ['1686142519756641000', '1686142520411000000', '1686142519997000000'],
          },
          {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: ['id1', 'id2', 'id3'],
          },
        ],
        length: 3,
        meta: {
          custom: {
            frameType: 'LabeledTimeValues',
          },
        },
      },
    ];

    const expected = {
      hasUniqueLabels: true,
      meta: [],
      rows: [
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line1',
          entryFieldIndex: 2,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {
            counter: '38141',
            label: 'val2',
            level: 'warning',
          },
          logLevel: 'warning',
          raw: 'line1',
          rowIndex: 0,
          searchWords: [],
          timeEpochMs: 1686142519756,
          timeEpochNs: '1686142519756641000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:19-06:00',
          timeLocal: '2023-06-07 06:55:19',
          timeUtc: '2023-06-07 12:55:19',
          uid: 'A_id1',
          uniqueLabels: {
            counter: '38141',
            label: 'val2',
            level: 'warning',
          },
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line2',
          entryFieldIndex: 2,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {
            counter: '38143',
            label: 'val2',
            level: 'info',
          },
          logLevel: 'info',
          raw: 'line2',
          rowIndex: 1,
          searchWords: [],
          timeEpochMs: 1686142520411,
          timeEpochNs: '1686142520411000000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:20-06:00',
          timeLocal: '2023-06-07 06:55:20',
          timeUtc: '2023-06-07 12:55:20',
          uid: 'A_id2',
          uniqueLabels: {
            counter: '38143',
            label: 'val2',
            level: 'info',
          },
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line3',
          entryFieldIndex: 2,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {
            counter: '38142',
            label: 'val3',
            level: 'info',
          },
          logLevel: 'info',
          raw: 'line3',
          rowIndex: 2,
          searchWords: [],
          timeEpochMs: 1686142519997,
          timeEpochNs: '1686142519997000000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:19-06:00',
          timeLocal: '2023-06-07 06:55:19',
          timeUtc: '2023-06-07 12:55:19',
          uid: 'A_id3',
          uniqueLabels: {
            counter: '38142',
            label: 'val3',
            level: 'info',
          },
        },
      ],
    };

    expect(logSeriesToLogsModel(frames)).toStrictEqual(expected);
  });

  it('should parse an Elasticsearch-style frame', () => {
    const frames: DataFrame[] = [
      {
        refId: 'A',
        meta: {},
        fields: [
          {
            name: '@timestamp',
            type: FieldType.time,
            config: {},
            values: [1686143280325, 1686143279324, 1686143278324],
          },
          {
            name: 'line',
            type: FieldType.string,
            config: {},
            values: ['line1', 'line2', 'line3'],
          },
          {
            name: '_id',
            type: FieldType.string,
            config: {},
            values: ['id1', 'id2', 'id3'],
          },
          {
            name: '_index',
            type: FieldType.string,
            config: {},
            values: ['logs-2023.06.07', 'logs-2023.06.07', 'logs-2023.06.07'],
          },
          {
            name: '_source',
            type: FieldType.other,
            config: {},
            values: [
              {
                '@timestamp': '2023-06-07T13:08:00.325Z',
                counter: '300',
                label: 'val2',
                level: 'info',
                line: 'line1',
                shapes: [{ type: 'triangle' }, { type: 'triangle' }, { type: 'triangle' }, { type: 'square' }],
              },
              {
                '@timestamp': '2023-06-07T13:07:59.324Z',
                counter: '299',
                label: 'val1',
                level: 'error',
                line: 'line2',
                shapes: [{ type: 'triangle' }, { type: 'triangle' }, { type: 'triangle' }, { type: 'square' }],
              },
              {
                '@timestamp': '2023-06-07T13:07:58.324Z',
                counter: '298',
                label: 'val2',
                level: 'error',
                line: 'line3',
                shapes: [{ type: 'triangle' }, { type: 'triangle' }, { type: 'triangle' }, { type: 'square' }],
              },
            ],
          },
          {
            name: 'counter',
            type: FieldType.string,
            config: {},
            values: ['300', '299', '298'],
          },
          {
            name: 'label',
            type: FieldType.string,
            config: {},
            values: ['val2', 'val1', 'val2'],
          },
          {
            name: 'level',
            type: FieldType.string,
            config: {},
            values: ['info', 'error', 'error'],
          },
          {
            name: 'shapes',
            type: FieldType.other,
            config: {},
            values: [
              [{ type: 'triangle' }, { type: 'triangle' }, { type: 'triangle' }, { type: 'square' }],
              [{ type: 'triangle' }, { type: 'triangle' }, { type: 'triangle' }, { type: 'square' }],
              [{ type: 'triangle' }, { type: 'triangle' }, { type: 'triangle' }, { type: 'square' }],
            ],
          },
        ],
        length: 3,
      },
    ];

    const expected = {
      hasUniqueLabels: false,
      meta: [],
      rows: [
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line1',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'info',
          raw: 'line1',
          rowIndex: 0,
          searchWords: [],
          timeEpochMs: 1686143280325,
          timeEpochNs: '1686143280325000000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T07:08:00-06:00',
          timeLocal: '2023-06-07 07:08:00',
          timeUtc: '2023-06-07 13:08:00',
          uid: 'A_0',
          uniqueLabels: {},
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line2',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'error',
          raw: 'line2',
          rowIndex: 1,
          searchWords: [],
          timeEpochMs: 1686143279324,
          timeEpochNs: '1686143279324000000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T07:07:59-06:00',
          timeLocal: '2023-06-07 07:07:59',
          timeUtc: '2023-06-07 13:07:59',
          uid: 'A_1',
          uniqueLabels: {},
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line3',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'error',
          raw: 'line3',
          rowIndex: 2,
          searchWords: [],
          timeEpochMs: 1686143278324,
          timeEpochNs: '1686143278324000000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T07:07:58-06:00',
          timeLocal: '2023-06-07 07:07:58',
          timeUtc: '2023-06-07 13:07:58',
          uid: 'A_2',
          uniqueLabels: {},
        },
      ],
    };

    expect(logSeriesToLogsModel(frames)).toStrictEqual(expected);
  });

  it('should parse timestamps when no nanosecond data and no nanosecond field', () => {
    const frames: DataFrame[] = [
      {
        refId: 'A',
        fields: [
          {
            name: 'timestamp',
            type: FieldType.time,
            config: {},
            values: [1686142519756, 1686142520411, 1686142519997],
          },
          {
            name: 'body',
            type: FieldType.string,
            config: {},
            values: ['line1', 'line2', 'line3'],
          },
        ],
        length: 3,
      },
    ];

    const expected = {
      hasUniqueLabels: false,
      meta: [],
      rows: [
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line1',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line1',
          rowIndex: 0,
          searchWords: [],
          timeEpochMs: 1686142519756,
          timeEpochNs: '1686142519756000000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:19-06:00',
          timeLocal: '2023-06-07 06:55:19',
          timeUtc: '2023-06-07 12:55:19',
          uid: 'A_0',
          uniqueLabels: {},
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line2',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line2',
          rowIndex: 1,
          searchWords: [],
          timeEpochMs: 1686142520411,
          timeEpochNs: '1686142520411000000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:20-06:00',
          timeLocal: '2023-06-07 06:55:20',
          timeUtc: '2023-06-07 12:55:20',
          uid: 'A_1',
          uniqueLabels: {},
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line3',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line3',
          rowIndex: 2,
          searchWords: [],
          timeEpochMs: 1686142519997,
          timeEpochNs: '1686142519997000000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:19-06:00',
          timeLocal: '2023-06-07 06:55:19',
          timeUtc: '2023-06-07 12:55:19',
          uid: 'A_2',
          uniqueLabels: {},
        },
      ],
    };

    expect(logSeriesToLogsModel(frames)).toStrictEqual(expected);
  });

  it('should parse timestamps when no nanosecond data and nanosecond field', () => {
    const frames: DataFrame[] = [
      {
        refId: 'A',
        fields: [
          {
            name: 'timestamp',
            type: FieldType.time,
            config: {},
            values: [1686142519756, 1686142520411, 1686142519997],
          },
          {
            name: 'body',
            type: FieldType.string,
            config: {},
            values: ['line1', 'line2', 'line3'],
          },
          {
            name: 'tsNs',
            type: FieldType.string,
            config: {},
            values: ['1686142519756641000', '1686142520411000000', '1686142519997123456'],
          },
        ],
        length: 3,
      },
    ];

    const expected = {
      hasUniqueLabels: false,
      meta: [],
      rows: [
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line1',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line1',
          rowIndex: 0,
          searchWords: [],
          timeEpochMs: 1686142519756,
          timeEpochNs: '1686142519756641000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:19-06:00',
          timeLocal: '2023-06-07 06:55:19',
          timeUtc: '2023-06-07 12:55:19',
          uid: 'A_0',
          uniqueLabels: {},
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line2',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line2',
          rowIndex: 1,
          searchWords: [],
          timeEpochMs: 1686142520411,
          timeEpochNs: '1686142520411000000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:20-06:00',
          timeLocal: '2023-06-07 06:55:20',
          timeUtc: '2023-06-07 12:55:20',
          uid: 'A_1',
          uniqueLabels: {},
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line3',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line3',
          rowIndex: 2,
          searchWords: [],
          timeEpochMs: 1686142519997,
          timeEpochNs: '1686142519997123456',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:19-06:00',
          timeLocal: '2023-06-07 06:55:19',
          timeUtc: '2023-06-07 12:55:19',
          uid: 'A_2',
          uniqueLabels: {},
        },
      ],
    };

    expect(logSeriesToLogsModel(frames)).toStrictEqual(expected);
  });

  it('should parse timestamps when nanosecond data in the time field and no nanosecond field', () => {
    const frames: DataFrame[] = [
      {
        refId: 'A',
        fields: [
          {
            name: 'timestamp',
            type: FieldType.time,
            config: {},
            values: [1686142519756, 1686142520411, 1686142519997],
            nanos: [641, 0, 123456],
          },
          {
            name: 'body',
            type: FieldType.string,
            config: {},
            values: ['line1', 'line2', 'line3'],
          },
        ],
        length: 3,
      },
    ];

    const expected = {
      hasUniqueLabels: false,
      meta: [],
      rows: [
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line1',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line1',
          rowIndex: 0,
          searchWords: [],
          timeEpochMs: 1686142519756,
          timeEpochNs: '1686142519756000641',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:19-06:00',
          timeLocal: '2023-06-07 06:55:19',
          timeUtc: '2023-06-07 12:55:19',
          uid: 'A_0',
          uniqueLabels: {},
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line2',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line2',
          rowIndex: 1,
          searchWords: [],
          timeEpochMs: 1686142520411,
          timeEpochNs: '1686142520411000000',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:20-06:00',
          timeLocal: '2023-06-07 06:55:20',
          timeUtc: '2023-06-07 12:55:20',
          uid: 'A_1',
          uniqueLabels: {},
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line3',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line3',
          rowIndex: 2,
          searchWords: [],
          timeEpochMs: 1686142519997,
          timeEpochNs: '1686142519997123456',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:19-06:00',
          timeLocal: '2023-06-07 06:55:19',
          timeUtc: '2023-06-07 12:55:19',
          uid: 'A_2',
          uniqueLabels: {},
        },
      ],
    };

    expect(logSeriesToLogsModel(frames)).toStrictEqual(expected);
  });

  it('should parse timestamps when both nanosecond data and nanosecond field, the field wins', () => {
    // whether the dataframe-field wins or the nanosecond-data in the time-field wins,
    // is arbitrary at the end. we simply have to pick one option, and keep doing that.
    const frames: DataFrame[] = [
      {
        refId: 'A',
        fields: [
          {
            name: 'timestamp',
            type: FieldType.time,
            config: {},
            values: [1686142519756, 1686142520411, 1686142519997],
            nanos: [1, 2, 3],
          },
          {
            name: 'body',
            type: FieldType.string,
            config: {},
            values: ['line1', 'line2', 'line3'],
          },
          {
            name: 'tsNs',
            type: FieldType.string,
            config: {},
            values: ['1686142519756000004', '1686142520411000005', '1686142519997000006'],
          },
        ],
        length: 3,
      },
    ];

    const expected = {
      hasUniqueLabels: false,
      meta: [],
      rows: [
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line1',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line1',
          rowIndex: 0,
          searchWords: [],
          timeEpochMs: 1686142519756,
          timeEpochNs: '1686142519756000004',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:19-06:00',
          timeLocal: '2023-06-07 06:55:19',
          timeUtc: '2023-06-07 12:55:19',
          uid: 'A_0',
          uniqueLabels: {},
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line2',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line2',
          rowIndex: 1,
          searchWords: [],
          timeEpochMs: 1686142520411,
          timeEpochNs: '1686142520411000005',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:20-06:00',
          timeLocal: '2023-06-07 06:55:20',
          timeUtc: '2023-06-07 12:55:20',
          uid: 'A_1',
          uniqueLabels: {},
        },
        {
          dataFrame: frames[0],
          datasourceType: undefined,
          entry: 'line3',
          entryFieldIndex: 1,
          hasAnsi: false,
          hasUnescapedContent: false,
          labels: {},
          logLevel: 'unknown',
          raw: 'line3',
          rowIndex: 2,
          searchWords: [],
          timeEpochMs: 1686142519997,
          timeEpochNs: '1686142519997000006',
          timeFromNow: 'mock:dateTimeFormatTimeAgo:2023-06-07T06:55:19-06:00',
          timeLocal: '2023-06-07 06:55:19',
          timeUtc: '2023-06-07 12:55:19',
          uid: 'A_2',
          uniqueLabels: {},
        },
      ],
    };

    expect(logSeriesToLogsModel(frames)).toStrictEqual(expected);
  });
});
