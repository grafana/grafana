import { of } from 'rxjs';

import {
  DataQueryResponse,
  FieldType,
  LogRowContextQueryDirection,
  LogRowModel,
  createDataFrame,
  dateTime,
} from '@grafana/data';
import { setTemplateSrv, TemplateSrv } from '@grafana/runtime';

import LokiLanguageProvider from './LanguageProvider';
import {
  LogContextProvider,
  LOKI_LOG_CONTEXT_PRESERVED_LABELS,
  SHOULD_INCLUDE_PIPELINE_OPERATIONS,
} from './LogContextProvider';
import { createLokiDatasource } from './mocks/datasource';
import { LokiQuery } from './types';

const defaultLanguageProviderMock = {
  start: jest.fn(),
  fetchLabels: jest.fn(() => ['bar', 'xyz']),
  getLabelKeys: jest.fn(() => ['bar', 'xyz']),
} as unknown as LokiLanguageProvider;

const defaultLogRow = {
  rowIndex: 0,
  dataFrame: createDataFrame({
    fields: [
      {
        name: 'ts',
        type: FieldType.time,
        values: [0],
      },
      {
        name: 'labelTypes',
        type: FieldType.other,
        values: [{ bar: 'I', foo: 'S', xyz: 'I' }],
      },
    ],
  }),
  labels: { bar: 'baz', foo: 'uniqueParsedLabel', xyz: 'abc' },
  uid: '1',
  timeEpochMs: new Date().getTime(),
} as unknown as LogRowModel;

const frameWithoutTypes = {
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
  timeEpochMs: new Date().getTime(),
} as unknown as LogRowModel;

describe('LogContextProvider', () => {
  let logContextProvider: LogContextProvider;
  beforeEach(() => {
    const templateSrv = {
      replace: jest.fn((str: string) => str?.replace('$test', 'baz')),
    };
    setTemplateSrv(templateSrv as unknown as TemplateSrv);
    const defaultDatasourceMock = createLokiDatasource(templateSrv);
    defaultDatasourceMock.query = jest.fn(() => of({ data: [] } as DataQueryResponse));
    defaultDatasourceMock.languageProvider = defaultLanguageProviderMock;
    logContextProvider = new LogContextProvider(defaultDatasourceMock);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe('getLogRowContext', () => {
    it('should call getInitContextFilters if no cachedContextFilters', async () => {
      logContextProvider.getInitContextFilters = jest.fn().mockResolvedValue({
        contextFilters: [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }],
        preservedFiltersApplied: false,
      });

      expect(logContextProvider.cachedContextFilters).toHaveLength(0);
      await logContextProvider.getLogRowContext(
        defaultLogRow,
        {
          limit: 10,
          direction: LogRowContextQueryDirection.Backward,
        },
        {
          expr: '{bar="baz"}',
          refId: 'A',
        }
      );
      expect(logContextProvider.getInitContextFilters).toBeCalled();
      expect(logContextProvider.getInitContextFilters).toHaveBeenCalledWith(
        expect.objectContaining({ labels: { bar: 'baz', foo: 'uniqueParsedLabel', xyz: 'abc' } }),
        { expr: '{bar="baz"}', refId: 'A' },
        {
          from: dateTime(defaultLogRow.timeEpochMs),
          to: dateTime(defaultLogRow.timeEpochMs),
          raw: { from: dateTime(defaultLogRow.timeEpochMs), to: dateTime(defaultLogRow.timeEpochMs) },
        }
      );
      expect(logContextProvider.cachedContextFilters).toHaveLength(1);
    });

    it('should replace variables before getInitContextFilters', async () => {
      logContextProvider.getInitContextFilters = jest.fn().mockResolvedValue({
        contextFilters: [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }],
        preservedFiltersApplied: false,
      });

      expect(logContextProvider.cachedContextFilters).toHaveLength(0);
      await logContextProvider.getLogRowContext(
        defaultLogRow,
        {
          limit: 10,
          direction: LogRowContextQueryDirection.Backward,
          scopedVars: { test: { value: 'baz', text: 'baz' } },
        },
        {
          expr: '{bar="$test"}',
          refId: 'A',
        }
      );
      expect(logContextProvider.getInitContextFilters).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expr: '{bar="baz"}', refId: 'A' }),
        expect.anything()
      );
    });

    it('should not call getInitContextFilters if cachedContextFilters', async () => {
      logContextProvider.getInitContextFilters = jest
        .fn()
        .mockResolvedValue([{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }]);

      logContextProvider.cachedContextFilters = [
        { value: 'baz', enabled: true, nonIndexed: false, label: 'bar' },
        { value: 'abc', enabled: true, nonIndexed: false, label: 'xyz' },
      ];
      await logContextProvider.getLogRowContext(defaultLogRow, {
        limit: 10,
        direction: LogRowContextQueryDirection.Backward,
      });
      expect(logContextProvider.getInitContextFilters).not.toBeCalled();
      expect(logContextProvider.cachedContextFilters).toHaveLength(2);
    });
  });

  describe('getLogRowContextQuery', () => {
    it('should call getInitContextFilters if no cachedContextFilters', async () => {
      logContextProvider.getInitContextFilters = jest.fn().mockResolvedValue({
        contextFilters: [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }],
        preservedFiltersApplied: false,
      });

      const query = await logContextProvider.getLogRowContextQuery(defaultLogRow, {
        limit: 10,
        direction: LogRowContextQueryDirection.Backward,
      });
      expect(query.expr).toBe('{bar="baz"}');
      expect(logContextProvider.getInitContextFilters).toHaveBeenCalled();
    });

    it('should replace variables before getInitContextFilters', async () => {
      logContextProvider.getInitContextFilters = jest.fn().mockResolvedValue({
        contextFilters: [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }],
        preservedFiltersApplied: false,
      });

      const query = await logContextProvider.getLogRowContextQuery(
        defaultLogRow,
        {
          limit: 10,
          direction: LogRowContextQueryDirection.Backward,
        },
        {
          expr: '{bar="$test"}',
          refId: 'A',
        }
      );
      expect(query.expr).toBe('{bar="baz"}');
    });

    it('should also call getInitContextFilters if cacheFilters is not set', async () => {
      logContextProvider.getInitContextFilters = jest.fn().mockResolvedValue({
        contextFilters: [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }],
        preservedFiltersApplied: false,
      });
      logContextProvider.cachedContextFilters = [
        { value: 'baz', enabled: true, nonIndexed: false, label: 'bar' },
        { value: 'abc', enabled: true, nonIndexed: false, label: 'xyz' },
      ];
      await logContextProvider.getLogRowContextQuery(
        defaultLogRow,
        {
          limit: 10,
          direction: LogRowContextQueryDirection.Backward,
        },
        undefined,
        false
      );
      expect(logContextProvider.getInitContextFilters).toHaveBeenCalled();
    });
  });

  describe('prepareLogRowContextQueryTarget', () => {
    describe('query with no parser', () => {
      const query = {
        expr: '{bar="baz"}',
        refId: 'A',
      };
      it('returns empty expression if no cachedContextFilters', async () => {
        logContextProvider.cachedContextFilters = [];
        const result = await logContextProvider.prepareLogRowContextQueryTarget(
          defaultLogRow,
          10,
          LogRowContextQueryDirection.Backward,
          query
        );
        expect(result.query.expr).toEqual('{}');
      });

      it('should apply parsed label as structured metadata', async () => {
        logContextProvider.cachedContextFilters = [
          { value: 'baz', enabled: true, nonIndexed: false, label: 'bar' },
          { value: 'abc', enabled: true, nonIndexed: false, label: 'xyz' },
          { value: 'uniqueParsedLabel', enabled: true, nonIndexed: true, label: 'foo' },
        ];
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
          defaultLogRow,
          10,
          LogRowContextQueryDirection.Backward,
          query
        );

        expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"} | foo=`uniqueParsedLabel`');
      });
    });

    describe('query with parser', () => {
      it('should apply parser', async () => {
        logContextProvider.cachedContextFilters = [
          { value: 'baz', enabled: true, nonIndexed: false, label: 'bar' },
          { value: 'abc', enabled: true, nonIndexed: false, label: 'xyz' },
        ];
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
          defaultLogRow,
          10,
          LogRowContextQueryDirection.Backward,
          {
            expr: '{bar="baz"} | logfmt',
            refId: 'A',
          }
        );

        expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"} | logfmt');
      });

      it('should apply parser and parsed labels', async () => {
        logContextProvider.cachedContextFilters = [
          { value: 'baz', enabled: true, nonIndexed: false, label: 'bar' },
          { value: 'abc', enabled: true, nonIndexed: false, label: 'xyz' },
          { value: 'uniqueParsedLabel', enabled: true, nonIndexed: true, label: 'foo' },
        ];
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
          defaultLogRow,
          10,
          LogRowContextQueryDirection.Backward,
          {
            expr: '{bar="baz"} | logfmt',
            refId: 'A',
          }
        );

        expect(contextQuery.query.expr).toEqual('{bar="baz",xyz="abc"} | logfmt | foo=`uniqueParsedLabel`');
      });
    });

    it('should not apply parser and parsed labels if more parsers in original query', async () => {
      logContextProvider.cachedContextFilters = [
        { value: 'baz', enabled: true, nonIndexed: false, label: 'bar' },
        { value: 'uniqueParsedLabel', enabled: true, nonIndexed: true, label: 'foo' },
      ];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | json',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | foo=\`uniqueParsedLabel\``);
    });

    it('should not apply line_format if flag is not set by default', async () => {
      logContextProvider.cachedContextFilters = [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo"',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt`);
    });

    it('should not apply line_format if flag is not set', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'false');
      logContextProvider.cachedContextFilters = [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt  | line_format "foo"',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt`);
    });

    it('should apply line_format if flag is set', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
      logContextProvider.cachedContextFilters = [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo"',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo"`);
    });

    it('should not apply line filters if flag is set', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
      logContextProvider.cachedContextFilters = [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }];
      let contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo" |= "bar"',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo"`);

      contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo" |~ "bar"',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo"`);

      contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo" !~ "bar"',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo"`);

      contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo" != "bar"',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo"`);
    });

    it('should not apply line filters if nested between two operations', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
      logContextProvider.cachedContextFilters = [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo" |= "bar" | label_format a="baz"',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo" | label_format a="baz"`);
    });

    it('should not apply label filters', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
      logContextProvider.cachedContextFilters = [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo" | bar > 1 | label_format a="baz"',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | line_format "foo" | label_format a="baz"`);
    });

    it('should not apply additional parsers', async () => {
      window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
      logContextProvider.cachedContextFilters = [{ value: 'baz', enabled: true, nonIndexed: false, label: 'bar' }];
      const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(
        defaultLogRow,
        10,
        LogRowContextQueryDirection.Backward,
        {
          expr: '{bar="baz"} | logfmt | line_format "foo" | json | label_format a="baz"',
          refId: 'A',
        }
      );

      expect(contextQuery.query.expr).toEqual(`{bar="baz"}`);
    });
  });

  describe('getInitContextFilters', () => {
    describe('query with no parser', () => {
      const queryWithoutParser: LokiQuery = {
        expr: '{bar="baz"}',
        refId: 'A',
      };

      const queryWithParser: LokiQuery = {
        expr: '{bar="baz"} | logfmt',
        refId: 'A',
      };

      const timeRange = {
        from: dateTime(defaultLogRow.timeEpochMs),
        to: dateTime(defaultLogRow.timeEpochMs),
        raw: { from: dateTime(defaultLogRow.timeEpochMs), to: dateTime(defaultLogRow.timeEpochMs) },
      };

      it('should correctly create contextFilters', async () => {
        const result = await logContextProvider.getInitContextFilters(defaultLogRow, queryWithoutParser);
        expect(result.contextFilters).toEqual([
          { enabled: true, nonIndexed: false, label: 'bar', value: 'baz' },
          { enabled: false, nonIndexed: true, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, nonIndexed: false, label: 'xyz', value: 'abc' },
        ]);
        expect(result.preservedFiltersApplied).toBe(false);
      });

      it('should return empty contextFilters if no query', async () => {
        const filters = (await logContextProvider.getInitContextFilters(defaultLogRow, undefined)).contextFilters;
        expect(filters).toEqual([]);
      });

      it('should return empty contextFilters if no labels', async () => {
        const filters = (
          await logContextProvider.getInitContextFilters({ labels: [] } as unknown as LogRowModel, queryWithoutParser)
        ).contextFilters;
        expect(filters).toEqual([]);
      });

      it('should call fetchLabels with stream selector if parser', async () => {
        await logContextProvider.getInitContextFilters(defaultLogRow, queryWithParser);
        expect(defaultLanguageProviderMock.fetchLabels).toBeCalledWith({ streamSelector: `{bar="baz"}` });
      });

      it('should call fetchLabels with given time range', async () => {
        await logContextProvider.getInitContextFilters(defaultLogRow, queryWithParser, timeRange);
        expect(defaultLanguageProviderMock.fetchLabels).toBeCalledWith({ streamSelector: `{bar="baz"}`, timeRange });
      });

      it('should call `languageProvider.start` if no parser with given time range', async () => {
        await logContextProvider.getInitContextFilters(defaultLogRow, queryWithoutParser, timeRange);
        expect(defaultLanguageProviderMock.start).toBeCalledWith(timeRange);
      });
    });

    describe('query with parser', () => {
      const queryWithParser: LokiQuery = {
        expr: '{bar="baz"} | logfmt',
        refId: 'A',
      };

      it('should correctly create contextFilters', async () => {
        const result = await logContextProvider.getInitContextFilters(defaultLogRow, queryWithParser);
        expect(result.contextFilters).toEqual([
          { enabled: true, nonIndexed: false, label: 'bar', value: 'baz' },
          { enabled: false, nonIndexed: true, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, nonIndexed: false, label: 'xyz', value: 'abc' },
        ]);
        expect(result.preservedFiltersApplied).toBe(false);
      });

      it('should return empty contextFilters if no query', async () => {
        const filters = (await logContextProvider.getInitContextFilters(defaultLogRow, undefined)).contextFilters;
        expect(filters).toEqual([]);
      });

      it('should return empty contextFilters if no labels', async () => {
        const filters = (
          await logContextProvider.getInitContextFilters({ labels: [] } as unknown as LogRowModel, queryWithParser)
        ).contextFilters;
        expect(filters).toEqual([]);
      });
    });

    describe('with preserved labels', () => {
      const queryWithParser: LokiQuery = {
        expr: '{bar="baz"} | logfmt',
        refId: 'A',
      };

      it('should correctly apply preserved labels', async () => {
        window.localStorage.setItem(
          LOKI_LOG_CONTEXT_PRESERVED_LABELS,
          JSON.stringify({
            removedLabels: ['bar'],
            selectedExtractedLabels: ['foo'],
          })
        );
        const result = await logContextProvider.getInitContextFilters(defaultLogRow, queryWithParser);
        expect(result.contextFilters).toEqual([
          { enabled: false, nonIndexed: false, label: 'bar', value: 'baz' }, // disabled real label
          { enabled: true, nonIndexed: true, label: 'foo', value: 'uniqueParsedLabel' }, // enabled parsed label
          { enabled: true, nonIndexed: false, label: 'xyz', value: 'abc' },
        ]);
        expect(result.preservedFiltersApplied).toBe(true);
      });

      it('should correctly apply preserved labels with no types', async () => {
        window.localStorage.setItem(
          LOKI_LOG_CONTEXT_PRESERVED_LABELS,
          JSON.stringify({
            removedLabels: ['bar'],
            selectedExtractedLabels: ['foo'],
          })
        );
        const result = await logContextProvider.getInitContextFilters(frameWithoutTypes, queryWithParser);
        expect(result.contextFilters).toEqual([
          { enabled: false, nonIndexed: false, label: 'bar', value: 'baz' }, // disabled real label
          { enabled: true, nonIndexed: false, label: 'foo', value: 'uniqueParsedLabel' }, // enabled parsed label
          { enabled: true, nonIndexed: false, label: 'xyz', value: 'abc' },
        ]);
        expect(result.preservedFiltersApplied).toBe(true);
      });

      it('should use contextFilters from row labels if all real labels are disabled', async () => {
        window.localStorage.setItem(
          LOKI_LOG_CONTEXT_PRESERVED_LABELS,
          JSON.stringify({
            removedLabels: ['bar', 'xyz'],
            selectedExtractedLabels: ['foo'],
          })
        );
        const result = await logContextProvider.getInitContextFilters(defaultLogRow, queryWithParser);
        expect(result.contextFilters).toEqual([
          { enabled: true, nonIndexed: false, label: 'bar', value: 'baz' }, // enabled real label
          { enabled: false, nonIndexed: true, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, nonIndexed: false, label: 'xyz', value: 'abc' }, // enabled real label
        ]);
        expect(result.preservedFiltersApplied).toBe(false);
      });

      it('should use contextFilters from row labels if all real labels are disabled with no types', async () => {
        window.localStorage.setItem(
          LOKI_LOG_CONTEXT_PRESERVED_LABELS,
          JSON.stringify({
            removedLabels: ['bar', 'xyz'],
            selectedExtractedLabels: ['foo'],
          })
        );
        const result = await logContextProvider.getInitContextFilters(frameWithoutTypes, queryWithParser);
        expect(result.contextFilters).toEqual([
          { enabled: false, nonIndexed: false, label: 'bar', value: 'baz' }, // enabled real label
          { enabled: true, nonIndexed: false, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: false, nonIndexed: false, label: 'xyz', value: 'abc' }, // enabled real label
        ]);
        expect(result.preservedFiltersApplied).toBe(true);
      });

      it('should not introduce new labels as context filters', async () => {
        window.localStorage.setItem(
          LOKI_LOG_CONTEXT_PRESERVED_LABELS,
          JSON.stringify({
            removedLabels: ['bar'],
            selectedExtractedLabels: ['foo', 'new'],
          })
        );
        const result = await logContextProvider.getInitContextFilters(defaultLogRow, queryWithParser);
        expect(result.contextFilters).toEqual([
          { enabled: false, nonIndexed: false, label: 'bar', value: 'baz' },
          { enabled: true, nonIndexed: true, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, nonIndexed: false, label: 'xyz', value: 'abc' },
        ]);
        expect(result.preservedFiltersApplied).toBe(true);
      });

      it('should not introduce new labels as context filters with no label types', async () => {
        window.localStorage.setItem(
          LOKI_LOG_CONTEXT_PRESERVED_LABELS,
          JSON.stringify({
            removedLabels: ['bar'],
            selectedExtractedLabels: ['foo', 'new'],
          })
        );
        const result = await logContextProvider.getInitContextFilters(frameWithoutTypes, queryWithParser);
        expect(result.contextFilters).toEqual([
          { enabled: false, nonIndexed: false, label: 'bar', value: 'baz' },
          { enabled: true, nonIndexed: false, label: 'foo', value: 'uniqueParsedLabel' },
          { enabled: true, nonIndexed: false, label: 'xyz', value: 'abc' },
        ]);
        expect(result.preservedFiltersApplied).toBe(true);
      });
    });
  });

  describe('queryContainsValidPipelineStages', () => {
    it('should return true if query contains a line_format stage', () => {
      expect(
        logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} | line_format "foo"', refId: 'A' })
      ).toBe(true);
    });

    it('should return true if query contains a label_format stage', () => {
      expect(
        logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} | label_format a="foo"', refId: 'A' })
      ).toBe(true);
    });

    it('should return false if query contains a parser', () => {
      expect(logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} | json', refId: 'A' })).toBe(
        false
      );
    });

    it('should return false if query contains a line filter', () => {
      expect(logContextProvider.queryContainsValidPipelineStages({ expr: '{foo="bar"} |= "test"', refId: 'A' })).toBe(
        false
      );
    });

    it('should return true if query contains a line filter and a label_format', () => {
      expect(
        logContextProvider.queryContainsValidPipelineStages({
          expr: '{foo="bar"} |= "test" | label_format a="foo"',
          refId: 'A',
        })
      ).toBe(true);
    });
  });
});
