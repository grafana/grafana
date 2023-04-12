import { FieldCache, FieldType, LogRowModel, TimeRange, toUtc } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import LokiLanguageProvider from './LanguageProvider';
import { LokiContextUi } from './components/LokiContextUi';
import { REF_ID_STARTER_LOG_ROW_CONTEXT } from './datasource';
import { escapeLabelValueInExactSelector } from './languageUtils';
import { addLabelToQuery, addParserToQuery } from './modifyQuery';
import { getParserFromQuery, isLokiQuery, isQueryWithParser } from './queryUtils';
import { ContextFilter, LokiQuery, LokiQueryDirection, LokiQueryType } from './types';

export class LogContextProvider {
  languageProvider: LokiLanguageProvider;
  contextFilters: { [key: string]: ContextFilter[] };
  onContextClose: (() => void) | undefined;

  constructor(languageProvider: LokiLanguageProvider) {
    this.languageProvider = languageProvider;
    this.contextFilters = {};
  }

  async prepareLogRowContextQueryTarget(
    row: LogRowModel,
    limit: number,
    direction: 'BACKWARD' | 'FORWARD',
    origQuery?: DataQuery
  ): Promise<{ query: LokiQuery; range: TimeRange }> {
    let originalLokiQuery: LokiQuery | undefined = undefined;
    // Type guard for LokiQuery
    if (origQuery && isLokiQuery(origQuery)) {
      originalLokiQuery = origQuery;
    }
    let expr = await this.prepareContextExpr(row, originalLokiQuery);

    const contextTimeBuffer = 2 * 60 * 60 * 1000; // 2h buffer

    const queryDirection = direction === 'FORWARD' ? LokiQueryDirection.Forward : LokiQueryDirection.Backward;

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
      this.contextFilters[row.uid] = contextFilters;

      if (runContextQuery) {
        runContextQuery();
      }
    };

    // we need to cache this function so that it doesn't get recreated on every render
    this.onContextClose =
      this.onContextClose ??
      (() => {
        delete this.contextFilters[row.uid];
      });

    return LokiContextUi({
      row,
      updateFilter,
      languageProvider: this.languageProvider,
      onClose: this.onContextClose,
    });
  }

  private async prepareContextExpr(row: LogRowModel, query: LokiQuery | undefined): Promise<string> {
    await this.languageProvider.start();
    const labelKeys = this.languageProvider.getLabelKeys();

    if (this.contextFilters[row.uid]) {
      // If we have context filters, use them to create query expr
      return this.processContextFiltersToExpr(row, query);
    } else {
      // Otherwise use labels from row
      return this.processRowToExpr(labelKeys, row, query);
    }
  }

  private processContextFiltersToExpr = (row: LogRowModel, query: LokiQuery | undefined) => {
    const labelFilters = this.contextFilters[row.uid]
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
        const parsedLabels = this.contextFilters[row.uid].filter((filter) => filter.fromParser && filter.enabled);
        for (const parsedLabel of parsedLabels) {
          if (parsedLabel.enabled) {
            expr = addLabelToQuery(expr, parsedLabel.label, '=', row.labels[parsedLabel.label]);
          }
        }
      }
    }

    return expr;
  };

  private processRowToExpr = (labelKeys: string[], row: LogRowModel, query: LokiQuery | undefined) => {
    const labelFilters = Object.keys(row.labels)
      .map((label: string) => {
        if (labelKeys.includes(label)) {
          // escape backslashes in label as users can't escape them by themselves
          return `${label}="${escapeLabelValueInExactSelector(row.labels[label])}"`;
        }
        return '';
      })
      .filter((label) => !!label)
      .join(',');

    let expr = `{${labelFilters}}`;

    // We also want to include parser, if it exists in original query
    if (query && isQueryWithParser(query.expr).parserCount === 1) {
      const parser = getParserFromQuery(query.expr);
      if (parser) {
        expr = addParserToQuery(expr, parser);
      }
    }
    return expr;
  };
}
