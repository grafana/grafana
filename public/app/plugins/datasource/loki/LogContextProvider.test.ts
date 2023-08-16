import { of } from 'rxjs';

import { DataQueryResponse, FieldType, LogRowContextQueryDirection, LogRowModel, createDataFrame } from '@grafana/data';

import LokiLanguageProvider from './LanguageProvider';
import {
  LogContextProvider,
  LOKI_LOG_CONTEXT_PRESERVED_LABELS,
  SHOULD_INCLUDE_PIPELINE_OPERATIONS,
} from './LogContextProvider';
import { createLokiDatasource } from './mocks';
import { LokiQuery } from './types';

jest.mock('app/core/store', () => {
  return {
    get(item: string) {
      return window.localStorage.getItem(item);
    },
    getBool(key: string, defaultValue?: boolean) {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      } else {
        return item === 'true';
      }
    },
  };
});

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

  afterEach(() => {
    window.localStorage.clear();
  });

  describe('getLogRowContext', () => {
    it('should call getInitContextFilters if no appliedContextFilters', async () => {
      logContextProvider.getInitContextFilters = jest
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
      expect(logContextProvider.getInitContextFilters).toBeCalled();
      expect(logContextProvider.getInitContextFilters).toHaveBeenCalledWith(
        { bar: 'baz', foo: 'uniqueParsedLabel', xyz: 'abc' },
        { expr: '{bar="baz"}' }
      );
      expect(logContextProvider.appliedContextFilters).toHaveLength(1);
    });

    it('should not call getInitContextFilters if appliedContextFilters', async () => {
      logContextProvider.getInitContextFilters = jest
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
      expect(logContextProvider.getInitContextFilters).not.toBeCalled();
      expect(logContextProvider.appliedContextFilters).toHaveLength(2);
    });
  });

  describe('getLogRowContextQuery', () => {
    it('should call getInitContextFilters if no appliedContextFilters', async () => {
      logContextProvider.getInitContextFilters = jest
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

    it('should not apply line_format if flag is not set by default', async () => {
      logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format = "foo"',
        } as unknown as LokiQuery
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt`);
    });

    it('should not apply line_format if flag is not set', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'false');
      logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt  | line_format = "foo"',
        } as unknown as LokiQuery
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt`);
    });

    it('should apply line_format if flag is set', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
      logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format = "foo"',
        } as unknown as LokiQuery
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format = "foo"`);
    });

    it('should not apply line filters if flag is set', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
      logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
      let contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format = "foo" |= "bar"',
        } as unknown as LokiQuery
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format = "foo"`);

      contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format = "foo" |~ "bar"',
        } as unknown as LokiQuery
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format = "foo"`);

      contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format = "foo" !~ "bar"',
        } as unknown as LokiQuery
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format = "foo"`);

      contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format = "foo" != "bar"',
        } as unknown as LokiQuery
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format = "foo"`);
    });

    it('should not apply line filters if nested between two operations', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
      logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo" |= "bar" | label_format a="baz"',
        } as unknown as LokiQuery
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo" | label_format a="baz"`);
    });

    it('should not apply label filters', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
      logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo" | bar > 1 | label_format a="baz"',
        } as unknown as LokiQuery
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo" | label_format a="baz"`);
    });

    it('should not apply additional parsers', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
      logContextProvider.appliedContextFilters = [{ value: 'baz', enabled: true, fromParser: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo" | json | label_format a="baz"',
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
        const filters = await logContextProvider.getInitContextFilters(defaultLogRow.labels, queryWithoutParser);
        expect(filters).toEqual([
          { enabled: true, fromParser: false, label: 'bar', value: 'baz' },
          { enabled: false, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, fromParser: false, label: 'xyz', value: 'abc' },
        ]);
      });

      it('should return empty contextFilters if no query', async () => {
        const filters = await logContextProvider.getInitContextFilters(defaultLogRow.labels, undefined);
        expect(filters).toEqual([]);
      });

      it('should return empty contextFilters if no labels', async () => {
        const filters = await logContextProvider.getInitContextFilters({}, queryWithoutParser);
        expect(filters).toEqual([]);
      });
    });

    describe('query with parser', () => {
      const queryWithParser = {
        expr: '{bar="baz"} | logfmt',
      } as LokiQuery;

      it('should correctly create contextFilters', async () => {
        const filters = await logContextProvider.getInitContextFilters(defaultLogRow.labels, queryWithParser);
        expect(filters).toEqual([
          { enabled: true, fromParser: false, label: 'bar', value: 'baz' },
          { enabled: false, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, fromParser: false, label: 'xyz', value: 'abc' },
        ]);
      });

      it('should return empty contextFilters if no query', async () => {
        const filters = await logContextProvider.getInitContextFilters(defaultLogRow.labels, undefined);
        expect(filters).toEqual([]);
      });

      it('should return empty contextFilters if no labels', async () => {
        const filters = await logContextProvider.getInitContextFilters({}, queryWithParser);
        expect(filters).toEqual([]);
      });
    });

    describe('with preserved labels', () => {
      const queryWithParser = {
        expr: '{bar="baz"} | logfmt',
      } as LokiQuery;

      it('should correctly apply preserved labels', async () => {
        window.localStorage.setItem(
          LOKI_LOG_CONTEXT_PRESERVED_LABELS,
          JSON.stringify({
            removedLabels: ['bar'],
            selectedExtractedLabels: ['foo'],
          })
        );
        const filters = await logContextProvider.getInitContextFilters(defaultLogRow.labels, queryWithParser);
        expect(filters).toEqual([
          { enabled: false, fromParser: false, label: 'bar', value: 'baz' }, // disabled real label
          { enabled: true, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' }, // enabled parsed label
          { enabled: true, fromParser: false, label: 'xyz', value: 'abc' },
        ]);
      });

      it('should use contextFilters from row labels if all real labels are disabled', async () => {
        window.localStorage.setItem(
          LOKI_LOG_CONTEXT_PRESERVED_LABELS,
          JSON.stringify({
            removedLabels: ['bar', 'xyz'],
            selectedExtractedLabels: ['foo'],
          })
        );
        const filters = await logContextProvider.getInitContextFilters(defaultLogRow.labels, queryWithParser);
        expect(filters).toEqual([
          { enabled: true, fromParser: false, label: 'bar', value: 'baz' }, // enabled real label
          { enabled: false, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, fromParser: false, label: 'xyz', value: 'abc' }, // enabled real label
        ]);
      });

      it('should not introduce new labels as context filters', async () => {
        window.localStorage.setItem(
          LOKI_LOG_CONTEXT_PRESERVED_LABELS,
          JSON.stringify({
            removedLabels: ['bar'],
            selectedExtractedLabels: ['foo', 'new'],
          })
        );
        const filters = await logContextProvider.getInitContextFilters(defaultLogRow.labels, queryWithParser);
        expect(filters).toEqual([
          { enabled: false, fromParser: false, label: 'bar', value: 'baz' },
          { enabled: true, fromParser: true, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, fromParser: false, label: 'xyz', value: 'abc' },
        ]);
      });
    });
  });

  describe('queryContainsValidPipelineStages', () => {
    it('should return true if query contains a line_format stage', () => {
      expect(
        logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} | line_format "foo"' } as LokiQuery)
      ).toBe(true);
    });

    it('should return true if query contains a label_format stage', () => {
      expect(
        logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} | label_format a="foo"' } as LokiQuery)
      ).toBe(true);
    });

    it('should return false if query contains a parser', () => {
      expect(logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} | json' } as LokiQuery)).toBe(
        false
      );
    });

    it('should return false if query contains a line filter', () => {
      expect(logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} |= "test"' } as LokiQuery)).toBe(
        false
      );
    });

    it('should return true if query contains a line filter and a label_format', () => {
      expect(
        logContextProvider.queryContainsValidPipelineStages({
          expr: '{foo="bar"} |= "test" | label_format a="foo"',
        } as LokiQuery)
      ).toBe(true);
    });
  });
});
