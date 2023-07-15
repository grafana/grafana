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
import { LabelParser, LabelFilter, LineFilters, PipelineStage } from '@grafana/lezer-logql';
import { Labels } from '@grafana/schema';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import store from 'app/core/store';
import { dispatch } from 'app/store/store';

import { LokiContextUi } from './components/LokiContextUi';
import { LokiDatasource, makeRequest, REF_ID_STARTER_LOG_ROW_CONTEXT } from './datasource';
import { escapeLabelValueInExactSelector } from './languageUtils';
import { addLabelToQuery, addParserToQuery } from './modifyQuery';
import {
  getNodePositionsFromQuery,
  getParserFromQuery,
  getStreamSelectorsFromQuery,
  isQueryWithParser,
} from './queryUtils';
import { sortDataFrameByTime, SortDirection } from './sortDataFrame';
import { ContextFilter, LokiQuery, LokiQueryDirection, LokiQueryType } from './types';

export const LOKI_LOG_CONTEXT_PRESERVED_LABELS = 'lokiLogContextPreservedLabels';
export const SHOULD_INCLUDE_PIPELINE_OPERATIONS = 'lokiLogContextShouldIncludePipelineOperations';

export type PreservedLabels = {
  removedLabels: string[];
  selectedExtractedLabels: string[];
};

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
      const filters = (await this.getInitContextFilters(row.labels, origQuery)).filter((filter) => filter.enabled);
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
    const expr = this.prepareExpression(this.appliedContextFilters, origQuery);

    const contextTimeBuffer = 2 * 60 * 60 * 1000; // 2h buffer

    const queryDirection =
      direction === LogRowContextQueryDirection.Forward ? LokiQueryDirection.Forward : LokiQueryDirection.Backward;

    const query: LokiQuery = {
      expr,
      queryType: LokiQueryType.Range,
      // refId has to be:
      // - always different (temporarily, will be fixed later)
      // - not increase in size
      // because it may be called many times from logs-context
      refId: `${REF_ID_STARTER_LOG_ROW_CONTEXT}_${Math.random().toString()}`,
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
      runContextQuery,
    });
  }

  prepareExpression(contextFilters: ContextFilter[], query: LokiQuery | undefined): string {
    let preparedExpression = this.processContextFiltersToExpr(contextFilters, query);
    if (store.getBool(SHOULD_INCLUDE_PIPELINE_OPERATIONS, false)) {
      preparedExpression = this.processPipelineStagesToExpr(preparedExpression, query);
    }
    return preparedExpression;
  }

  processContextFiltersToExpr = (contextFilters: ContextFilter[], query: LokiQuery | undefined): string => {
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

  processPipelineStagesToExpr = (currentExpr: string, query: LokiQuery | undefined): string => {
    let newExpr = currentExpr;
    const origExpr = query?.expr ?? '';

    if (isQueryWithParser(origExpr).parserCount > 1) {
      return newExpr;
    }

    const allNodePositions = getNodePositionsFromQuery(origExpr, [
      PipelineStage,
      LabelParser,
      LineFilters,
      LabelFilter,
    ]);
    const pipelineStagePositions = allNodePositions.filter((position) => position.type?.id === PipelineStage);
    const otherNodePositions = allNodePositions.filter((position) => position.type?.id !== PipelineStage);

    for (const pipelineStagePosition of pipelineStagePositions) {
      // we don't process pipeline stages that contain label parsers, line filters or label filters
      if (otherNodePositions.some((position) => pipelineStagePosition.contains(position))) {
        continue;
      }

      newExpr += ` ${pipelineStagePosition.getExpression(origExpr)}`;
    }

    return newExpr;
  };

  queryContainsValidPipelineStages = (query: LokiQuery | undefined): boolean => {
    const origExpr = query?.expr ?? '';
    const allNodePositions = getNodePositionsFromQuery(origExpr, [
      PipelineStage,
      LabelParser,
      LineFilters,
      LabelFilter,
    ]);
    const pipelineStagePositions = allNodePositions.filter((position) => position.type?.id === PipelineStage);
    const otherNodePositions = allNodePositions.filter((position) => position.type?.id !== PipelineStage);

    return pipelineStagePositions.some((pipelineStagePosition) =>
      otherNodePositions.every((position) => pipelineStagePosition.contains(position) === false)
    );
  };

  getInitContextFilters = async (labels: Labels, query?: LokiQuery) => {
    if (!query || isEmpty(labels)) {
      return [];
    }

    // 1. First we need to get all labels from the log row's label
    // and correctly set parsed and not parsed labels
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

    // Secondly we check for preserved labels and update enabled state of filters based on that
    let preservedLabels: undefined | PreservedLabels = undefined;
    try {
      preservedLabels = JSON.parse(store.get(LOKI_LOG_CONTEXT_PRESERVED_LABELS));
      // Do nothing when error occurs
    } catch (e) {}

    if (!preservedLabels) {
      // If we don't have preservedLabels, we return contextFilters as they are
      return contextFilters;
    } else {
      // Otherwise, we need to update filters based on preserved labels
      let arePreservedLabelsUsed = false;
      const newContextFilters = contextFilters.map((contextFilter) => {
        // We checked for undefined above
        if (preservedLabels!.removedLabels.includes(contextFilter.label)) {
          arePreservedLabelsUsed = true;
          return { ...contextFilter, enabled: false };
        }
        // We checked for undefined above
        if (preservedLabels!.selectedExtractedLabels.includes(contextFilter.label)) {
          arePreservedLabelsUsed = true;
          return { ...contextFilter, enabled: true };
        }
        return { ...contextFilter };
      });

      const isAtLeastOneRealLabelEnabled = newContextFilters.some(({ enabled, fromParser }) => enabled && !fromParser);
      if (!isAtLeastOneRealLabelEnabled) {
        // If we end up with no real labels enabled, we need to reset the init filters
        return contextFilters;
      } else {
        // Otherwise use new filters
        if (arePreservedLabelsUsed) {
          dispatch(notifyApp(createSuccessNotification('Previously used log context filters have been applied.')));
        }
        return newContextFilters;
      }
    }
  };
}
