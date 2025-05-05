import saveAs from 'file-saver';

import { dataFrameFromJSON, DataFrameJSON, dateTimeFormat, FieldType, LogRowModel, LogsMetaKind } from '@grafana/data';

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
        values: [[100], ['a'], [1]],
      },
    };

    it.each([[dataFrameFromJSON(json), 'test', '"time","name","value"\r\n100,a,1']])(
      'should, when logsModel is %s and title is %s, resolve in %s',
      async (dataFrame, title, expected) => {
        downloadDataFrameAsCsv(dataFrame, title);
        const call = (saveAs as unknown as jest.Mock).mock.calls[0];
        const blob = call[0];
        const filename = call[1];
        const text = await blob.text();

        // By default the BOM character should not be included
        expect(await hasBOM(blob)).toBe(false);
        expect(text).toEqual(expected);
        expect(filename).toEqual(`${title}-data-${dateTimeFormat(1400000000000)}.csv`);
      }
    );

    it('should include the BOM character when useExcelHeader is true', async () => {
      downloadDataFrameAsCsv(dataFrameFromJSON(json), 'test', { useExcelHeader: true });

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = await blob.text();

      expect(await hasBOM(blob)).toBe(true);
      expect(text).toEqual('sep=,\r\n"time","name","value"\r\n100,a,1');
      expect(filename).toEqual(`test-data-${dateTimeFormat(1400000000000)}.csv`);
    });
  });

  describe('downloadAsJson', () => {
    it.each([
      ['foo', 'test', '"foo"'],
      [1, 'test', '1'],
      [{ foo: 'bar' }, 'test', '{"foo":"bar"}'],
    ])('should, when logsModel is %s and title is %s, resolve in %s', async (logsModel, title, expected) => {
      downloadAsJson(logsModel, title);
      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = await blob.text();

      expect(text).toEqual(expected);
      expect(filename).toEqual(`${title}-${dateTimeFormat(1400000000000)}.json`);
    });
  });

  describe('downloadLogsModelAsTxt', () => {
    it.each([
      [{ meta: [], rows: [] }, 'test', '\n\n'],
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
      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = await blob.text();

      expect(text).toEqual(expected);
      expect(filename).toEqual(`${title}-logs-${dateTimeFormat(1400000000000)}.txt`);
    });

    it('should, when title is empty, resolve in %s', async () => {
      downloadLogsModelAsTxt({ meta: [], rows: [] });
      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const filename = call[1];
      expect(filename).toEqual(`Logs-${dateTimeFormat(1400000000000)}.txt`);
    });
  });
});

async function hasBOM(blob: Blob) {
  const reader = new FileReader();
  return new Promise<boolean>((resolve, reject) => {
    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (event.target?.result instanceof ArrayBuffer) {
        const arr = new Uint8Array(event.target.result);
        resolve(arr[0] === 0xef && arr[1] === 0xbb && arr[2] === 0xbf); // Check for UTF-8 BOM
      } else {
        reject(new Error('Unexpected FileReader result type'));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob.slice(0, 3)); // Read only the first 3 bytes
  });
}
