import { of } from 'rxjs';

import { DataQueryResponse, FieldType, LogRowContextQueryDirection, LogRowModel, createDataFrame } from '@grafana/data';

import LokiLanguageProvider from './LanguageProvider';
import { LogContextProvider } from './LogContextProvider';
import { createLokiDatasource } from './mocks';
import { LokiQuery } from './types';

const defaultLanguageProviderMock = {
  start: jest.fn(),
  fetchSeriesLabels: jest.fn(() => ({ bar: ['baz'], xyz: ['abc'] })),
  getLabelKeys: jest.fn(() => ['bar', 'xyz']),
} as unknown as LokiLanguageProvider;

const defaultDatasourceMock = createLokiDatasource();
defaultDatasourceMock.query = jest.fn(() => of({ data: [] } as DataQueryResponse));
defaultDatasourceMock.languageProvider = defaultLanguageProviderMock;

const defaultLogRow = {
  rowIndex: 0,
  dataFrame: createDataFrame({
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
  });

  describe('getLogRowContext', () => {
    it('should call getInitContextFilters if no appliedContextFilters', async () => {
      logContextProvider.getInitContextFiltersFromLabels = jest
        .fn()
        .mockResolvedValue([{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }]);

      expect(logContextProvider.appliedContextFilters).toHaveLength(0);
      await logContextProvider.getLogRowContext(
        defaultLogRow,
        {
          limit: 10,
          direction: LogRowContextQueryDirection.Backward,
        },
        {
          expr: '{bar="baz"}',
        } as LokiQuery
      );
      expect(logContextProvider.getInitContextFiltersFromLabels).toBeCalled();
      expect(logContextProvider.getInitContextFiltersFromLabels).toHaveBeenCalledWith(
        { bar: 'baz', foo: 'uniqueParsedLabel', xyz: 'abc' },
        { expr: '{bar="baz"}' }
      );
      expect(logContextProvider.appliedContextFilters).toHaveLength(1);
    });

    it('should not call getInitContextFilters if appliedContextFilters', async () => {
      logContextProvider.getInitContextFiltersFromLabels = jest
        .fn()
        .mockResolvedValue([{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }]);

      logContextProvider.appliedContextFilters = [
        { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
        { value: 'abc', enabled: true, fromParser: false, label: 'xyz' },
      ];
      await logContextProvider.getLogRowContext(defaultLogRow, {
        limit: 10,
        direction: LogRowContextQueryDirection.Backward,
      });
      expect(logContextProvider.getInitContextFiltersFromLabels).not.toBeCalled();
      expect(logContextProvider.appliedContextFilters).toHaveLength(2);
    });
  });

  describe('getLogRowContextQuery', () => {
    it('should call getInitContextFilters if no appliedContextFilters', async () => {
      logContextProvider.getInitContextFiltersFromLabels = jest
        .fn()
        .mockResolvedValue([{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }]);

      const query = await logContextProvider.getLogRowContextQuery(defaultLogRow, {
        limit: 10,
        direction: LogRowContextQueryDirection.Backward,
      });
      expect(query.expr).toBe('{bar="baz"}');
    });

    it('should not call getInitContextFilters if appliedContextFilters', async () => {
      logContextProvider.appliedContextFilters = [
        { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
        { value: 'abc', enabled: true, fromParser: false, label: 'xyz' },
      ];
      const query = await logContextProvider.getLogRowContextQuery(defaultLogRow, {
        limit: 10,
        direction: LogRowContextQueryDirection.Backward,
      });
      expect(query.expr).toBe('{bar="baz",xyz="abc"}');
    });
  });

  describe('prepareLogRowContextQueryTarget', () => {
    describe('query with no parser', () => {
      const query = {
        expr: '{bar="baz"}',
      } as LokiQuery;
      it('returns empty expression if no appliedContextFilters', async () => {
        logContextProvider.appliedContextFilters = [];
        const result = await logContextProvider.prepareLogRowContextQueryTarget(
          defaultLogRow,
          10,
          LogRowContextQueryDirection.Backward,
          query
        );
        expect(result.query.expr).toEqual('{}');
      });

      it('should not apply parsed labels', async () => {
        logContextProvider.appliedContextFilters = [
          { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
          { value: 'abc', enabled: true, fromParser: false, label: 'xyz' },
          { value: 'uniqueParsedLabel', enabled: true, fromParser: true, label: 'foo' },
        ];
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
          defaultLogRow,
          10,
          LogRowContextQueryDirection.Backward,
          query
        );

        expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"}');
      });
    });

    describe('query with parser', () => {
      it('should apply parser', async () => {
        logContextProvider.appliedContextFilters = [
          { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
          { value: 'abc', enabled: true, fromParser: false, label: 'xyz' },
        ];
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
          defaultLogRow,
          10,
          LogRowContextQueryDirection.Backward,
          {
            expr: '{bar="baz"} | logfmt',
          } as LokiQuery
        );

        expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"} | logfmt');
      });

      it('should apply parser and parsed labels', async () => {
        logContextProvider.appliedContextFilters = [
          { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
          { value: 'abc', enabled: true, fromParser: false, label: 'xyz' },
          { value: 'uniqueParsedLabel', enabled: true, fromParser: true, label: 'foo' },
        ];
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
          defaultLogRow,
          10,
          LogRowContextQueryDirection.Backward,
          {
            expr: '{bar="baz"} | logfmt',
          } as LokiQuery
        );

        expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"} | logfmt | foo=`uniqueParsedLabel`');
      });
    });

    it('should not apply parser and parsed labels if more parsers in original query', async () => {
      logContextProvider.appliedContextFilters = [
        { value: 'baz', enabled: true, fromParser: false, label: 'bar' },
        { value: 'uniqueParsedLabel', enabled: true, fromParser: true, label: 'foo' },
      ];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | json',
        } as unknown as LokiQuery
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"}`);
    });
  });

  describe('getInitContextFiltersFromLabels', () => {
    describe('query with no parser', () => {
      const queryWithoutParser = {
        expr: '{bar="baz"}',
      } as LokiQuery;

      it('should correctly create contextFilters', async () => {
        const filters = await logContextProvider.getInitContextFiltersFromLabels(
          defaultLogRow.labels,
          queryWithoutParser
        );
        expect(filters).toEqual([
          { enabled: true, fromParser: false, label: 'bar', value: 'baz' },
          { enabled: false, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, fromParser: false, label: 'xyz', value: 'abc' },
        ]);
      });

      it('should return empty contextFilters if no query', async () => {
        const filters = await logContextProvider.getInitContextFiltersFromLabels(defaultLogRow.labels, undefined);
        expect(filters).toEqual([]);
      });

      it('should return empty contextFilters if no labels', async () => {
        const filters = await logContextProvider.getInitContextFiltersFromLabels({}, queryWithoutParser);
        expect(filters).toEqual([]);
      });
    });

    describe('query with parser', () => {
      const queryWithParser = {
        expr: '{bar="baz"} | logfmt',
      } as LokiQuery;

      it('should correctly create contextFilters', async () => {
        const filters = await logContextProvider.getInitContextFiltersFromLabels(defaultLogRow.labels, queryWithParser);
        expect(filters).toEqual([
          { enabled: true, fromParser: false, label: 'bar', value: 'baz' },
          { enabled: false, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, fromParser: false, label: 'xyz', value: 'abc' },
        ]);
      });

      it('should return empty contextFilters if no query', async () => {
        const filters = await logContextProvider.getInitContextFiltersFromLabels(defaultLogRow.labels, undefined);
        expect(filters).toEqual([]);
      });

      it('should return empty contextFilters if no labels', async () => {
        const filters = await logContextProvider.getInitContextFiltersFromLabels({}, queryWithParser);
        expect(filters).toEqual([]);
      });
    });
  });
});
