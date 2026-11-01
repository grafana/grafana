import saveAs from 'file-saver';

import {
  dataFrameFromJSON,
  type DataFrameJSON,
  dateTimeFormat,
  FieldType,
  type LogRowModel,
  LogsMetaKind,
} from '@grafana/data';
import { createLogRow } from 'app/features/logs/components/mocks/logRow';

import { downloadAsJson, downloadDataFrameAsCsv, downloadLogsModelAsTxt } from './download';

jest.mock('file-saver', () => jest.fn());

describe('inspector download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(1400000000000) });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('downloadDataFrameAsCsv', () => {
    const json: DataFrameJSON = {
      schema: {
        fields: [
          { name: 'time', type: FieldType.time },
          { name: 'name', type: FieldType.string },
          { name: 'value', type: FieldType.number },
        ],
      },
      data: {
        values: [[100], ['Åäö中文العربية'], [1]],
      },
    };

    it('end with a new line if asked', async () => {
      downloadDataFrameAsCsv(dataFrameFromJSON(json), 'test', undefined, undefined, false, true);

      const call = jest.mocked(saveAs).mock.calls[0];
      const blob = call[0];
      const text = typeof blob === 'string' ? blob : await blob.text();

      expect(text).toEqual('"time","name","value"\r\n100,Åäö中文العربية,1\r\n');
    });
  });

  describe('downloadAsJson', () => {
    it.each([
      ['foo', 'test', '"foo"'],
      [1, 'test', '1'],
      [{ foo: 'bar' }, 'test', '{"foo":"bar"}'],
    ])('should, when logsModel is %s and title is %s, resolve in %s', async (logsModel, title, expected) => {
      downloadAsJson(logsModel, title);
      const call = jest.mocked(saveAs).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = typeof blob === 'string' ? blob : await blob.text();

      expect(text).toEqual(expected);
      expect(filename).toEqual(`${title}-${dateTimeFormat(1400000000000)}.json`);
    });
  });

  describe('downloadLogsModelAsTxt', () => {
    it.each([
      [{ meta: [], rows: [] }, 'test', ''],
      [
        { meta: [{ label: 'testLabel', value: 'testValue', kind: LogsMetaKind.String }], rows: [] },
        'test',
        'testLabel: "testValue"\n\n\n',
      ],
      [{ meta: [{ label: 'testLabel', value: 1, kind: LogsMetaKind.Number }], rows: [] }, 'test', 'testLabel: 1\n\n\n'],
      [
        {
          meta: [
            { label: 'testLabel', value: 1, kind: LogsMetaKind.String },
            { label: 'secondTestLabel', value: 2, kind: LogsMetaKind.String },
          ],
          rows: [],
        },
        'test',
        'testLabel: 1\nsecondTestLabel: 2\n\n\n',
      ],
      [
        {
          meta: [
            { label: 'testLabel', value: 1, kind: LogsMetaKind.String },
            { label: 'secondTestLabel', value: 2, kind: LogsMetaKind.String },
          ],
          rows: [{ timeEpochMs: 100, entry: 'testEntry' } as unknown as LogRowModel],
        },
        'test',
        `testLabel: 1\nsecondTestLabel: 2\n\n\n100\t1970-01-01T00:00:00.100Z\ttestEntry\n`,
      ],
    ])('should, when logsModel is %s and title is %s, resolve in %s', async (logsModel, title, expected) => {
      downloadLogsModelAsTxt(logsModel, title);
      const call = jest.mocked(saveAs).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = typeof blob === 'string' ? blob : blob.size === 0 ? '' : await blob.text();

      expect(text).toEqual(expected);
      expect(filename).toEqual(`${title}-logs-${dateTimeFormat(1400000000000)}.txt`);
    });

    it('should, when title is empty, resolve in %s', async () => {
      downloadLogsModelAsTxt({ meta: [], rows: [] });
      const call = jest.mocked(saveAs).mock.calls[0];
      const filename = call[1];
      expect(filename).toEqual(`Logs-${dateTimeFormat(1400000000000)}.txt`);
    });

    it('should, when title is empty, resolve in %s', async () => {
      downloadLogsModelAsTxt({ meta: [], rows: [] });
      const call = jest.mocked(saveAs).mock.calls[0];
      const filename = call[1];
      expect(filename).toEqual(`Logs-${dateTimeFormat(1400000000000)}.txt`);
    });

    it('should should download selected fields', async () => {
      const logsModel = {
        meta: [],
        rows: [
          createLogRow({ timeEpochMs: 100, entry: 'testEntry', labels: { label: 'value', otherLabel: 'other value' } }),
        ],
      };
      downloadLogsModelAsTxt(logsModel, undefined, ['label', 'otherLabel']);
      const call = jest.mocked(saveAs).mock.calls[0];
      const blob = call[0];
      const text = typeof blob === 'string' ? blob : await blob.text();

      expect(text).toContain('value other value');
    });
  });
});
