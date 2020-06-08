import React from 'react';
import { FieldType, LogRowModel, MutableDataFrame, Labels, LogLevel, DataQueryResponse } from '@grafana/data';
import { getRowContexts, LogRowContextProvider } from './LogRowContextProvider';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';

describe('getRowContexts', () => {
  describe('when called with a DataFrame and results are returned', () => {
    it('then the result should be in correct format and filtered', async () => {
      const firstResult = new MutableDataFrame({
        refId: 'B',
        fields: [
          { name: 'ts', type: FieldType.time, values: [3, 2, 1] },
          { name: 'line', type: FieldType.string, values: ['3', '2', '1'], labels: {} },
          { name: 'id', type: FieldType.string, values: ['3', '2', '1'], labels: {} },
        ],
      });
      const secondResult = new MutableDataFrame({
        refId: 'B',
        fields: [
          { name: 'ts', type: FieldType.time, values: [6, 5, 4] },
          { name: 'line', type: FieldType.string, values: ['6', '5', '4'], labels: {} },
          { name: 'id', type: FieldType.string, values: ['6', '5', '4'], labels: {} },
        ],
      });
      let called = false;
      const getRowContextMock = (row: LogRowModel, options?: any): Promise<DataQueryResponse> => {
        if (!called) {
          called = true;
          return Promise.resolve({ data: [firstResult] });
        }
        return Promise.resolve({ data: [secondResult] });
      };

      const result = await getRowContexts(getRowContextMock, row, 10);

      expect(result).toEqual({
        data: [
          ['3', '2'],
          ['6', '5', '4'],
        ],
        errors: ['', ''],
      });
    });

    it('then the result should be in correct format and filtered without uid', async () => {
      const firstResult = new MutableDataFrame({
        refId: 'B',
        fields: [
          { name: 'ts', type: FieldType.time, values: [3, 2, 1] },
          { name: 'line', type: FieldType.string, values: ['3', '2', '1'], labels: {} },
        ],
      });
      const secondResult = new MutableDataFrame({
        refId: 'B',
        fields: [
          { name: 'ts', type: FieldType.time, values: [6, 5, 4] },
          { name: 'line', type: FieldType.string, values: ['6', '5', '4'], labels: {} },
        ],
      });
      let called = false;
      const getRowContextMock = (row: LogRowModel, options?: any): Promise<DataQueryResponse> => {
        if (!called) {
          called = true;
          return Promise.resolve({ data: [firstResult] });
        }
        return Promise.resolve({ data: [secondResult] });
      };

      const result = await getRowContexts(getRowContextMock, row, 10);

      expect(result).toEqual({
        data: [
          ['3', '2', '1'],
          ['6', '5'],
        ],
        errors: ['', ''],
      });
    });
  });

  describe('when called with a DataFrame and errors occur', () => {
    it('then the result should be in correct format', async () => {
      const firstError = new Error('Error 1');
      const secondError = new Error('Error 2');
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

describe('LogRowContextProvider', () => {
  describe('when requesting longer context', () => {
    it('can request more log lines', async () => {
      const firstResult = new MutableDataFrame({
        refId: 'B',
        fields: [
          { name: 'ts', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          {
            name: 'line',
            type: FieldType.string,
            values: ['10', '9', '8', '7', '6', '5'],
            labels: {},
          },
          {
            name: 'id',
            type: FieldType.string,
            values: ['10', '9', '8', '7', '6', '5'],
            labels: {},
          },
        ],
      });

      const secondResult = new MutableDataFrame({
        refId: 'B',
        fields: [
          { name: 'ts', type: FieldType.time, values: [14, 13, 12] },
          { name: 'line', type: FieldType.string, values: ['14', '13', '12'], labels: {} },
          { name: 'id', type: FieldType.string, values: ['14', '13', '12'], labels: {} },
        ],
      });

      let called = false;
      const getRowContextMock = (row: LogRowModel, options?: any): Promise<DataQueryResponse> => {
        if (!called) {
          called = true;
          return Promise.resolve({ data: [firstResult] });
        }
        return Promise.resolve({ data: [secondResult] });
      };
      let updateLimitCalled = false;

      const mockedChildren = jest.fn((mockState: any) => {
        const { result, errors, hasMoreContextRows, updateLimit, limit } = mockState;
        if (!updateLimitCalled && result.before.length === 0) {
          expect(result).toEqual({ before: [], after: [] });
          expect(errors).toEqual({ before: undefined, after: undefined });
          expect(hasMoreContextRows).toEqual({ before: true, after: true });
          expect(limit).toBe(10);
          return <></>;
        }
        if (!updateLimitCalled && result.before.length > 0) {
          expect(result).toEqual({ before: ['10', '9', '8', '7', '6', '5'], after: ['14', '13', '12'] });
          expect(errors).toEqual({ before: '', after: '' });
          expect(hasMoreContextRows).toEqual({ before: true, after: true });
          expect(limit).toBe(10);
          updateLimit();
          updateLimitCalled = true;
          return <></>;
        }
        if (updateLimitCalled && result.before.length > 0 && limit > 10) {
          expect(limit).toBe(20);
        }
        return <></>;
      });
      await act(async () => {
        await mount(<LogRowContextProvider row={row} getRowContext={getRowContextMock} children={mockedChildren} />);
      });
    });
  });
});

const row: LogRowModel = {
  entryFieldIndex: 0,
  rowIndex: 0,
  dataFrame: new MutableDataFrame(),
  entry: '4',
  labels: (null as any) as Labels,
  hasAnsi: false,
  raw: '4',
  logLevel: LogLevel.info,
  timeEpochMs: 4,
  timeEpochNs: '4000000',
  timeFromNow: '',
  timeLocal: '',
  timeUtc: '',
  uid: '1',
};
