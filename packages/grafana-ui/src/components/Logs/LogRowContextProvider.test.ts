import { DataFrameHelper, FieldType, LogRowModel } from '@grafana/data';
import { getRowContexts } from './LogRowContextProvider';
import { Labels, LogLevel } from '@grafana/data/src';
import { DataQueryResponse } from '../../types';

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
        labels: (null as any) as Labels,
        hasAnsi: false,
        raw: '4',
        logLevel: LogLevel.info,
        timeEpochMs: 4,
        timeFromNow: '',
        timeLocal: '',
        timeUtc: '',
        timestamp: '4',
      };

      let called = false;
      const getRowContextMock = (row: LogRowModel, options?: any): Promise<DataQueryResponse> => {
        if (!called) {
          called = true;
          return Promise.resolve({ data: [firstResult] });
        }
        return Promise.resolve({ data: [secondResult] });
      };

      const result = await getRowContexts(getRowContextMock, row, 10);

      expect(result).toEqual({ data: [[['3', '2', '1']], [['6', '5', '4']]], errors: ['', ''] });
    });
  });

  describe('when called with a DataFrame and errors occur', () => {
    it('then the result should be in correct format', async () => {
      const firstError = new Error('Error 1');
      const secondError = new Error('Error 2');
      const row: LogRowModel = {
        entry: '4',
        labels: (null as any) as Labels,
        hasAnsi: false,
        raw: '4',
        logLevel: LogLevel.info,
        timeEpochMs: 4,
        timeFromNow: '',
        timeLocal: '',
        timeUtc: '',
        timestamp: '4',
      };

      let called = false;
      const getRowContextMock = (row: LogRowModel, options?: any): Promise<DataQueryResponse> => {
        if (!called) {
          called = true;
          return Promise.reject(firstError);
        }
        return Promise.reject(secondError);
      };

      const result = await getRowContexts(getRowContextMock, row, 10);

      expect(result).toEqual({ data: [[], []], errors: ['Error 1', 'Error 2'] });
    });
  });
});
