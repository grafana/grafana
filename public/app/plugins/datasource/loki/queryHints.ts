import { DataFrame, QueryHint } from '@grafana/data';

import { isQueryPipelineErrorFiltering, isQueryWithParser } from './query_utils';
import { extractHasErrorLabelFromDataFrame, extractLogParserFromDataFrame } from './responseUtils';

export function getQueryHints(query: string, series: DataFrame[]): QueryHint[] {
  if (series.length === 0) {
    return [];
  }

  const hints: QueryHint[] = [];
  const { queryWithParser, parserCount } = isQueryWithParser(query);

  if (!queryWithParser) {
    const { hasLogfmt, hasJSON } = extractLogParserFromDataFrame(series[0]);
    if (hasJSON) {
      hints.push({
        type: 'ADD_JSON_PARSER',
        label: 'Selected log stream selector has JSON formatted logs.',
        fix: {
          label: 'Consider using JSON parser.',
          action: {
            type: 'ADD_JSON_PARSER',
            query,
          },
        },
      });
    }

    if (hasLogfmt) {
      hints.push({
        type: 'ADD_LOGFMT_PARSER',
        label: 'Selected log stream selector has logfmt formatted logs.',
        fix: {
          label: 'Consider using logfmt parser to turn key-value pairs in your log lines to labels.',
          action: {
            type: 'ADD_LOGFMT_PARSER',
            query,
          },
        },
      });
    }
  }

  if (queryWithParser) {
    // To keep this simple, we consider pipeline error filtering hint only is query has up to 1 parser
    if (parserCount === 1) {
      const hasPipelineErrorFiltering = isQueryPipelineErrorFiltering(query);
      const hasError = extractHasErrorLabelFromDataFrame(series[0]);
      if (hasError && !hasPipelineErrorFiltering) {
        hints.push({
          type: 'ADD_NO_PIPELINE_ERROR',
          label: 'Some logs in your selected log streams have parsing error.',
          fix: {
            label: 'Consider filtering out logs with parsing errors.',
            action: {
              type: 'ADD_NO_PIPELINE_ERROR',
              query,
            },
          },
        });
      }
    }
  }

  return hints;
}
