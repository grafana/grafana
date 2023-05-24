import { isEmpty } from 'lodash';
import { catchError, lastValueFrom, of, switchMap } from 'rxjs';

import {
  CoreApp,
  DataFrame,
  DataQueryError,
  DataQueryResponse,
  FieldCache,
  FieldType,
  LogRowModel,
  TimeRange,
  toUtc,
  LogRowContextQueryDirection,
  LogRowContextOptions,
} from '@grafana/data';
import { Labels } from '@grafana/schema';

import { LokiContextUi } from './components/LokiContextUi';
import { LokiDatasource, makeRequest, REF_ID_STARTER_LOG_ROW_CONTEXT } from './datasource';
import { escapeLabelValueInExactSelector } from './languageUtils';
import { addLabelToQuery, addParserToQuery } from './modifyQuery';
import { getParserFromQuery, getStreamSelectorsFromQuery, isQueryWithParser } from './queryUtils';
import { sortDataFrameByTime, SortDirection } from './sortDataFrame';
import { ContextFilter, LokiQuery, LokiQueryDirection, LokiQueryType } from './types';

export class LogContextProvider {
  datasource: LokiDatasource;
  appliedContextFilters: ContextFilter[];
  onContextClose: (() => void) | undefined;

  constructor(datasource: LokiDatasource) {
    this.datasource = datasource;
    this.appliedContextFilters = [];
  }

  private async getQueryAndRange(row: LogRowModel, options?: LogRowContextOptions, origQuery?: LokiQuery) {
    const direction = (options && options.direction) || LogRowContextQueryDirection.Backward;
    const limit = (options && options.limit) || this.datasource.maxLines;
    // This happens only on initial load, when user haven't applied any filters yet
    // We need to get the initial filters from the row labels
    if (this.appliedContextFilters.length === 0) {
      const filters = (await this.getInitContextFiltersFromLabels(row.labels, origQuery)).filter(
        (filter) => filter.enabled
      );
      this.appliedContextFilters = filters;
    }

    return await this.prepareLogRowContextQueryTarget(row, limit, direction, origQuery);
  }

  getLogRowContextQuery = async (
    row: LogRowModel,
    options?: LogRowContextOptions,
    origQuery?: LokiQuery
  ): Promise<LokiQuery> => {
    const { query } = await this.getQueryAndRange(row, options, origQuery);

    return query;
  };

  getLogRowContext = async (
    row: LogRowModel,
    options?: LogRowContextOptions,
    origQuery?: LokiQuery
  ): Promise<{ data: DataFrame[] }> => {
    const direction = (options && options.direction) || LogRowContextQueryDirection.Backward;
    const { query, range } = await this.getQueryAndRange(row, options, origQuery);

    const processResults = (result: DataQueryResponse): DataQueryResponse => {
      const frames: DataFrame[] = result.data;
      const processedFrames = frames.map((frame) => sortDataFrameByTime(frame, SortDirection.Descending));

      return {
        ...result,
        data: processedFrames,
      };
    };

    // this can only be called from explore currently
    const app = CoreApp.Explore;

    return lastValueFrom(
      this.datasource.query(makeRequest(query, range, app, `${REF_ID_STARTER_LOG_ROW_CONTEXT}${direction}`)).pipe(
        catchError((err) => {
          const error: DataQueryError = {
            message: 'Error during context query. Please check JS console logs.',
            status: err.status,
            statusText: err.statusText,
          };
          throw error;
        }),
        switchMap((res) => of(processResults(res)))
      )
    );
  };

  async prepareLogRowContextQueryTarget(
    row: LogRowModel,
    limit: number,
    direction: LogRowContextQueryDirection,
    origQuery?: LokiQuery
  ): Promise<{ query: LokiQuery; range: TimeRange }> {
    const expr = this.processContextFiltersToExpr(row, this.appliedContextFilters, origQuery);
    const contextTimeBuffer = 2 * 60 * 60 * 1000; // 2h buffer

    const queryDirection =
      direction === LogRowContextQueryDirection.Forward ? LokiQueryDirection.Forward : LokiQueryDirection.Backward;

    const query: LokiQuery = {
      expr,
      queryType: LokiQueryType.Range,
      refId: `${REF_ID_STARTER_LOG_ROW_CONTEXT}${row.dataFrame.refId || ''}`,
      maxLines: limit,
      direction: queryDirection,
      datasource: { uid: this.datasource.uid, type: this.datasource.type },
    };

    const fieldCache = new FieldCache(row.dataFrame);
    const tsField = fieldCache.getFirstFieldOfType(FieldType.time);
    if (tsField === undefined) {
      throw new Error('loki: data frame missing time-field, should never happen');
    }
    const tsValue = tsField.values[row.rowIndex];
    const timestamp = toUtc(tsValue);

    const range =
      queryDirection === LokiQueryDirection.Forward
        ? {
            // start param in Loki API is inclusive so we'll have to filter out the row that this request is based from
            // and any other that were logged in the same ns but before the row. Right now these rows will be lost
            // because the are before but came it he response that should return only rows after.
            from: timestamp,
            // convert to ns, we lose some precision here but it is not that important at the far points of the context
            to: toUtc(row.timeEpochMs + contextTimeBuffer),
          }
        : {
            // convert to ns, we lose some precision here but it is not that important at the far points of the context
            from: toUtc(row.timeEpochMs - contextTimeBuffer),
            to: timestamp,
          };

    return {
      query,
      range: {
        from: range.from,
        to: range.to,
        raw: range,
      },
    };
  }

  getLogRowContextUi(row: LogRowModel, runContextQuery?: () => void, origQuery?: LokiQuery): React.ReactNode {
    const updateFilter = (contextFilters: ContextFilter[]) => {
      this.appliedContextFilters = contextFilters;

      if (runContextQuery) {
        runContextQuery();
      }
    };

    // we need to cache this function so that it doesn't get recreated on every render
    this.onContextClose =
      this.onContextClose ??
      (() => {
        this.appliedContextFilters = [];
      });

    return LokiContextUi({
      row,
      origQuery,
      updateFilter,
      onClose: this.onContextClose,
      logContextProvider: this,
    });
  }

  processContextFiltersToExpr = (row: LogRowModel, contextFilters: ContextFilter[], query: LokiQuery | undefined) => {
    const labelFilters = contextFilters
      .map((filter) => {
        if (!filter.fromParser && filter.enabled) {
          // escape backslashes in label as users can't escape them by themselves
          return `${filter.label}="${escapeLabelValueInExactSelector(filter.value)}"`;
        }
        return '';
      })
      // Filter empty strings
      .filter((label) => !!label)
      .join(',');

    let expr = `{${labelFilters}}`;

    // We need to have original query to get parser and include parsed labels
    // We only add parser and parsed labels if there is only one parser in query
    if (query && isQueryWithParser(query.expr).parserCount === 1) {
      const parser = getParserFromQuery(query.expr);
      if (parser) {
        expr = addParserToQuery(expr, parser);
        const parsedLabels = contextFilters.filter((filter) => filter.fromParser && filter.enabled);
        for (const parsedLabel of parsedLabels) {
          if (parsedLabel.enabled) {
            expr = addLabelToQuery(expr, parsedLabel.label, '=', parsedLabel.value);
          }
        }
      }
    }

    return expr;
  };

  getInitContextFiltersFromLabels = async (labels: Labels, query?: LokiQuery) => {
    if (!query || isEmpty(labels)) {
      return [];
    }

    let allLabels: string[] = [];
    if (!isQueryWithParser(query.expr).queryWithParser) {
      // If there is no parser, we use getLabelKeys because it has better caching
      // and all labels should already be fetched
      await this.datasource.languageProvider.start();
      allLabels = this.datasource.languageProvider.getLabelKeys();
    } else {
      // If we have parser, we use fetchSeriesLabels to fetch actual labels for selected stream
      const stream = getStreamSelectorsFromQuery(query.expr);
      // We are using stream[0] as log query can always have just 1 stream selector
      const series = await this.datasource.languageProvider.fetchSeriesLabels(stream[0]);
      allLabels = Object.keys(series);
    }

    const contextFilters: ContextFilter[] = [];
    Object.entries(labels).forEach(([label, value]) => {
      const filter: ContextFilter = {
        label,
        value: value,
        enabled: allLabels.includes(label),
        fromParser: !allLabels.includes(label),
      };

      contextFilters.push(filter);
    });

    return contextFilters;
  };
}
