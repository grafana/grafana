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
import { DataQuery, Labels } from '@grafana/schema';

import { LokiContextUi } from './components/LokiContextUi';
import { LokiDatasource, makeRequest, REF_ID_STARTER_LOG_ROW_CONTEXT } from './datasource';
import { escapeLabelValueInExactSelector } from './languageUtils';
import { addLabelToQuery, addParserToQuery } from './modifyQuery';
import { getParserFromQuery, isLokiQuery, isQueryWithParser } from './queryUtils';
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

  getLogRowContext = async (
    row: LogRowModel,
    options?: LogRowContextOptions,
    origQuery?: DataQuery
  ): Promise<{ data: DataFrame[] }> => {
    const direction = (options && options.direction) || LogRowContextQueryDirection.Backward;
    const limit = (options && options.limit) || 10;

    // This happens only on initial load, when user haven't applied any filters yet
    // We need to get the initial filters from the row labels
    if (this.appliedContextFilters.length === 0) {
      const filters = (await this.getInitContextFiltersFromLabels(row.labels)).filter((filter) => filter.enabled);
      this.appliedContextFilters = filters;
    }

    const { query, range } = await this.prepareLogRowContextQueryTarget(row, limit, direction, origQuery);

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
    origQuery?: DataQuery
  ): Promise<{ query: LokiQuery; range: TimeRange }> {
    let originalLokiQuery: LokiQuery | undefined = undefined;
    // Type guard for LokiQuery
    if (origQuery && isLokiQuery(origQuery)) {
      originalLokiQuery = origQuery;
    }
    const expr = this.processContextFiltersToExpr(row, this.appliedContextFilters, originalLokiQuery);
    const contextTimeBuffer = 2 * 60 * 60 * 1000; // 2h buffer

    const queryDirection =
      direction === LogRowContextQueryDirection.Forward ? LokiQueryDirection.Forward : LokiQueryDirection.Backward;

    const query: LokiQuery = {
      expr,
      queryType: LokiQueryType.Range,
      refId: `${REF_ID_STARTER_LOG_ROW_CONTEXT}${row.dataFrame.refId || ''}`,
      maxLines: limit,
      direction: queryDirection,
    };

    const fieldCache = new FieldCache(row.dataFrame);
    const tsField = fieldCache.getFirstFieldOfType(FieldType.time);
    if (tsField === undefined) {
      throw new Error('loki: data frame missing time-field, should never happen');
    }
    const tsValue = tsField.values.get(row.rowIndex);
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

  getLogRowContextUi(row: LogRowModel, runContextQuery: () => void): React.ReactNode {
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
      updateFilter,
      onClose: this.onContextClose,
      logContextProvider: this,
    });
  }

  processContextFiltersToExpr = (row: LogRowModel, contextFilters: ContextFilter[], query: LokiQuery | undefined) => {
    const labelFilters = contextFilters
      .map((filter) => {
        const label = filter.value;
        if (!filter.fromParser && filter.enabled) {
          // escape backslashes in label as users can't escape them by themselves
          return `${label}="${escapeLabelValueInExactSelector(row.labels[label])}"`;
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
            expr = addLabelToQuery(expr, parsedLabel.label, '=', row.labels[parsedLabel.label]);
          }
        }
      }
    }

    return expr;
  };

  getInitContextFiltersFromLabels = async (labels: Labels) => {
    await this.datasource.languageProvider.start();
    const allLabels = this.datasource.languageProvider.getLabelKeys();
    const contextFilters: ContextFilter[] = [];
    Object.entries(labels).forEach(([label, value]) => {
      const filter: ContextFilter = {
        label,
        value: label, // this looks weird in the first place, but we need to set the label as value here
        enabled: allLabels.includes(label),
        fromParser: !allLabels.includes(label),
        description: value,
      };
      contextFilters.push(filter);
    });

    return contextFilters;
  };
}
