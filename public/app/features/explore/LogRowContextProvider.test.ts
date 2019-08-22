import { DataFrameHelper, FieldType, LogRowModel } from '@grafana/data';
import { getRowContexts } from './LogRowContextProvider';

describe('getRowContexts', () => {
  describe('when called with a DataFrame and results are returned', () => {
    it('then the result should be in correct format', async () => {
      const firstResult = new DataFrameHelper({
        refId: 'B',
        labels: {},
        fields: [
          { name: 'ts', type: FieldType.time, values: [3, 2, 1] },
          { name: 'line', type: FieldType.string, values: ['3', '2', '1'] },
        ],
      });
      const secondResult = new DataFrameHelper({
        refId: 'B',
        labels: {},
        fields: [
          { name: 'ts', type: FieldType.time, values: [6, 5, 4] },
          { name: 'line', type: FieldType.string, values: ['6', '5', '4'] },
        ],
      });
      const row: LogRowModel = {
        entry: '4',
        labels: null,
        hasAnsi: false,
        raw: '4',
        logLevel: null,
        timeEpochMs: 4,
        timeFromNow: '',
        timeLocal: '',
        timeUtc: '',
        timestamp: '4',
      };

      const getRowContext = jest
        .fn()
        .mockResolvedValueOnce({ data: [firstResult] })
        .mockResolvedValueOnce({ data: [secondResult] });

      const result = await getRowContexts(getRowContext, row, 10);

      expect(result).toEqual({ data: [[['3', '2', '1']], [['6', '5', '4']]], errors: [null, null] });
    });
  });

  describe('when called with a DataFrame and errors occur', () => {
    it('then the result should be in correct format', async () => {
      const firstError = new Error('Error 1');
      const secondError = new Error('Error 2');
      const row: LogRowModel = {
        entry: '4',
        labels: null,
        hasAnsi: false,
        raw: '4',
        logLevel: null,
        timeEpochMs: 4,
        timeFromNow: '',
        timeLocal: '',
        timeUtc: '',
        timestamp: '4',
      };

      const getRowContext = jest
        .fn()
        .mockRejectedValueOnce(firstError)
        .mockRejectedValueOnce(secondError);

      const result = await getRowContexts(getRowContext, row, 10);

      expect(result).toEqual({ data: [[], []], errors: ['Error 1', 'Error 2'] });
    });
  });
});
