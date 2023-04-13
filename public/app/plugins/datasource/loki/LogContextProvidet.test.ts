import { of } from 'rxjs';

import { DataQueryResponse, FieldType, LogRowModel, MutableDataFrame } from '@grafana/data';

import LokiLanguageProvider from './LanguageProvider';
import { LogContextProvider } from './LogContextProvider';
import { createLokiDatasource } from './mocks';
import { LokiQuery } from './types';

const defaultLanguageProviderMock = {
  start: jest.fn(),
  getLabelKeys: jest.fn(() => ['bar', 'xyz']),
} as unknown as LokiLanguageProvider;

const defaultDatasourceMock = createLokiDatasource();
defaultDatasourceMock.query = jest.fn(() => of({ data: [] } as DataQueryResponse));
defaultDatasourceMock.languageProvider = defaultLanguageProviderMock;

const defaultLogRow = {
  rowIndex: 0,
  dataFrame: new MutableDataFrame({
    fields: [
      {
        name: 'ts',
        type: FieldType.time,
        values: [0],
      },
    ],
  }),
  labels: { bar: 'baz', foo: 'uniqueParsedLabel', xyz: 'abc' },
  uid: '1',
} as unknown as LogRowModel;

describe('LogContextProvider', () => {
  let logContextProvider: LogContextProvider;
  beforeEach(() => {
    logContextProvider = new LogContextProvider(defaultDatasourceMock);
    logContextProvider.getInitContextFilters = jest.fn(() =>
      Promise.resolve([{ value: 'bar', enabled: true, fromParser: false, label: 'bar' }])
    );
  });

  describe('getLogRowContext', () => {
    it('should call getInitContextFilters if no appliedContextFilters', async () => {
      expect(logContextProvider.appliedContextFilters).toHaveLength(0);
      await logContextProvider.getLogRowContext(defaultLogRow, { limit: 10, direction: 'BACKWARD' });
      expect(logContextProvider.getInitContextFilters).toBeCalled();
      expect(logContextProvider.appliedContextFilters).toHaveLength(1);
    });

    it('should not call getInitContextFilters if appliedContextFilters', async () => {
      logContextProvider.appliedContextFilters = [
        { value: 'bar', enabled: true, fromParser: false, label: 'bar' },
        { value: 'xyz', enabled: true, fromParser: false, label: 'xyz' },
      ];
      await logContextProvider.getLogRowContext(defaultLogRow, { limit: 10, direction: 'BACKWARD' });
      expect(logContextProvider.getInitContextFilters).not.toBeCalled();
      expect(logContextProvider.appliedContextFilters).toHaveLength(2);
    });
  });

  describe('prepareLogRowContextQueryTarget', () => {
    describe('query with no parser', () => {
      const query = {
        expr: '{bar="baz"}',
      } as LokiQuery;
      it('returns empty expression if no appliedContextFilters', async () => {
        logContextProvider.appliedContextFilters = [];
        const result = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD', query);
        expect(result.query.expr).toEqual('{}');
      });

      it('should not apply parsed labels', async () => {
        logContextProvider.appliedContextFilters = [
          { value: 'bar', enabled: true, fromParser: false, label: 'bar' },
          { value: 'xyz', enabled: true, fromParser: false, label: 'xyz' },
          { value: 'foo', enabled: true, fromParser: true, label: 'foo' },
        ];
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
          defaultLogRow,
          10,
          'BACKWARD',
          query
        );

        expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"}');
      });
    });

    describe('query with parser', () => {
      it('should apply parser', async () => {
        logContextProvider.appliedContextFilters = [
          { value: 'bar', enabled: true, fromParser: false, label: 'bar' },
          { value: 'xyz', enabled: true, fromParser: false, label: 'xyz' },
        ];
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD', {
          expr: '{bar="baz"} | logfmt',
        } as LokiQuery);

        expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"} | logfmt');
      });

      it('should apply parser and parsed labels', async () => {
        logContextProvider.appliedContextFilters = [
          { value: 'bar', enabled: true, fromParser: false, label: 'bar' },
          { value: 'xyz', enabled: true, fromParser: false, label: 'xyz' },
          { value: 'foo', enabled: true, fromParser: true, label: 'foo' },
        ];
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD', {
          expr: '{bar="baz"} | logfmt',
        } as LokiQuery);

        expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"} | logfmt | foo=`uniqueParsedLabel`');
      });
    });

    it('should not apply parser and parsed labels if more parsers in original query', async () => {
      logContextProvider.appliedContextFilters = [
        { value: 'bar', enabled: true, fromParser: false, label: 'bar' },
        { value: 'foo', enabled: true, fromParser: true, label: 'foo' },
      ];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD', {
        expr: '{bar="baz"} | logfmt | json',
      } as unknown as LokiQuery);

      expect(contextQuery.query.expr).toEqual(`{bar="baz"}`);
    });
  });
});
