import { FieldCache, FieldType, LogRowModel, TimeRange, toUtc } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import LokiLanguageProvider from './LanguageProvider';
import { LokiContextUi } from './components/LokiContextUi';
import { REF_ID_STARTER_LOG_ROW_CONTEXT } from './datasource';
import { escapeLabelValueInExactSelector } from './languageUtils';
import { addLabelToQuery, addParserToQuery } from './modifyQuery';
import { getParserFromQuery } from './queryUtils';
import { ContextFilter, LokiQuery, LokiQueryDirection, LokiQueryType } from './types';

export class LogContextProvider {
  languageProvider: LokiLanguageProvider;
  onContextClose: (() => void) | undefined;

  constructor(languageProvider: LokiLanguageProvider) {
    this.languageProvider = languageProvider;
  }

  prepareLogRowContextQueryTarget = async (
    row: LogRowModel,
    limit: number,
    direction: 'BACKWARD' | 'FORWARD',
    origQuery?: DataQuery
  ): Promise<{ query: LokiQuery; range: TimeRange }> => {
    let expr = await this.prepareContextExpr(row, origQuery);

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
  };

  getLogRowContextUi(row: LogRowModel, runContextQuery: () => void): React.ReactNode {
    const updateFilter = (contextFilters: ContextFilter[]) => {
      this.prepareContextExpr = async (row: LogRowModel, origQuery?: DataQuery) => {
        await this.languageProvider.start();
        const labels = this.languageProvider.getLabelKeys();

        let expr = contextFilters
          .map((filter) => {
            const label = filter.value;
            if (filter && !filter.fromParser && filter.enabled && labels.includes(label)) {
              // escape backslashes in label as users can't escape them by themselves
              return `${label}="${escapeLabelValueInExactSelector(row.labels[label])}"`;
            }
            return '';
          })
          // Filter empty strings
          .filter((label) => !!label)
          .join(',');

        expr = `{${expr}}`;

        const parserContextFilters = contextFilters.filter((filter) => filter.fromParser && filter.enabled);
        if (parserContextFilters.length) {
          // we should also filter for labels from parsers, let's find the right parser
          if (origQuery) {
            const parser = getParserFromQuery((origQuery as LokiQuery).expr);
            if (parser) {
              expr = addParserToQuery(expr, parser);
            }
          }
          for (const filter of parserContextFilters) {
            if (filter.enabled) {
              expr = addLabelToQuery(expr, filter.label, '=', row.labels[filter.label]);
            }
          }
        }
        return expr;
      };
      if (runContextQuery) {
        runContextQuery();
      }
    };

    // we need to cache this function so that it doesn't get recreated on every render
    this.onContextClose =
      this.onContextClose ??
      (() => {
        this.prepareContextExpr = this.prepareContextExprWithoutParsedLabels;
      });

    return LokiContextUi({
      row,
      updateFilter,
      languageProvider: this.languageProvider,
      onClose: this.onContextClose,
    });
  }

  async prepareContextExpr(row: LogRowModel, origQuery?: DataQuery): Promise<string> {
    return await this.prepareContextExprWithoutParsedLabels(row, origQuery);
  }

  private async prepareContextExprWithoutParsedLabels(row: LogRowModel, origQuery?: DataQuery): Promise<string> {
    await this.languageProvider.start();
    const labels = this.languageProvider.getLabelKeys();
    const expr = Object.keys(row.labels)
      .map((label: string) => {
        if (labels.includes(label)) {
          // escape backslashes in label as users can't escape them by themselves
          return `${label}="${escapeLabelValueInExactSelector(row.labels[label])}"`;
        }
        return '';
      })
      .filter((label) => !!label)
      .join(',');

    return `{${expr}}`;
  }
}
