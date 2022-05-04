import { QueryHint } from '@grafana/data';

import { LokiDatasource } from './datasource';
import { extractLogParser } from './query_utils';

export function getQueryHints(query: string, series?: any[], datasource?: LokiDatasource): QueryHint[] {
  const hints: QueryHint[] = [];
  if (series && series.length > 0) {
    const { hasLogfmt, hasJSON } = extractLogParser(series[0]);
    if (hasJSON) {
      hints.push({
        type: 'ADD_JSON_PARSER',
        label: 'Selected log stream selector has JSON formatted logs. ',
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
        label: 'Selected log stream selector has logfmt formatted logs. ',
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
