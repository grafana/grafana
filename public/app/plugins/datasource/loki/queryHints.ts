import { DataFrame, QueryHint } from '@grafana/data';

import { isQueryWithParser } from './query_utils';
import { extractLogParserFromDataFrame } from './responseUtils';

export function getQueryHints(query: string, series: DataFrame[]): QueryHint[] {
  const hints: QueryHint[] = [];
  if (series.length > 0) {
    const { hasLogfmt, hasJSON } = extractLogParserFromDataFrame(series[0]);
    const queryWithParser = isQueryWithParser(query);

    if (hasJSON && !queryWithParser) {
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

    if (hasLogfmt && !queryWithParser) {
      hints.push({
        type: 'ADD_LOGFMT_PARSER',
        label: 'Selected log stream selector has logfmt formatted logs.',
        fix: {
          label: 'Consider using logfmt parser.',
          action: {
            type: 'ADD_LOGFMT_PARSER',
            query,
          },
        },
      });
    }
  }

  return hints;
}
