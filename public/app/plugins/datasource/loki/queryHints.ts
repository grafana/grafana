import { DataFrame, QueryHint } from '@grafana/data';

import {
  isQueryWithLabelFilter,
  isQueryPipelineErrorFiltering,
  isQueryWithLabelFormat,
  isQueryWithParser,
  isQueryWithLineFilter,
} from './queryUtils';
import {
  dataFrameHasLevelLabel,
  extractHasErrorLabelFromDataFrame,
  extractLevelLikeLabelFromDataFrame,
  extractLogParserFromDataFrame,
} from './responseUtils';

export function getQueryHints(query: string, series: DataFrame[]): QueryHint[] {
  if (series.length === 0) {
    return [];
  }

  const hints: QueryHint[] = [];
  const { queryWithParser, parserCount } = isQueryWithParser(query);

  if (!queryWithParser) {
    const { hasLogfmt, hasJSON, hasPack } = extractLogParserFromDataFrame(series[0]);
    if (hasJSON) {
      if (hasPack) {
        hints.push({
          type: 'ADD_UNPACK_PARSER',
          label: 'Selected log stream selector has packed logs.',
          fix: {
            title: 'add unpack parser',
            label: 'Consider using unpack parser.',
            action: {
              type: 'ADD_UNPACK_PARSER',
              query,
            },
          },
        });
      } else {
        hints.push({
          type: 'ADD_JSON_PARSER',
          label: 'Selected log stream selector has JSON formatted logs.',
          fix: {
            title: 'add json parser',
            label: 'Consider using JSON parser.',
            action: {
              type: 'ADD_JSON_PARSER',
              query,
            },
          },
        });
      }
    }

    if (hasLogfmt) {
      hints.push({
        type: 'ADD_LOGFMT_PARSER',
        label: 'Selected log stream selector has logfmt formatted logs.',
        fix: {
          title: 'add logfmt parser',
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
            title: 'remove pipeline errors',
            label: 'Consider filtering out logs with parsing errors.',
            action: {
              type: 'ADD_NO_PIPELINE_ERROR',
              query,
            },
          },
        });
      }
    }

    const hasLabelFilter = isQueryWithLabelFilter(query);

    if (!hasLabelFilter) {
      hints.push({
        type: 'ADD_LABEL_FILTER',
        label: 'Consider filtering logs by their label and value.',
        fix: {
          title: 'add label filter',
          label: '',
          action: {
            type: 'ADD_LABEL_FILTER',
            query,
          },
        },
      });
    }
  }

  const queryWithLabelFormat = isQueryWithLabelFormat(query);
  if (!queryWithLabelFormat) {
    const hasLevel = dataFrameHasLevelLabel(series[0]);
    const levelLikeLabel = extractLevelLikeLabelFromDataFrame(series[0]);

    // Add hint only if we don't have "level" label and have level-like label
    if (!hasLevel && levelLikeLabel) {
      hints.push({
        type: 'ADD_LEVEL_LABEL_FORMAT',
        label: `Some logs in your selected log stream have "${levelLikeLabel}" label.`,
        fix: {
          title: 'add label level format',
          label: `If ${levelLikeLabel} label has level values, consider using label_format to rename it to "level". Level label can be then visualized in log volumes.`,
          action: {
            type: 'ADD_LEVEL_LABEL_FORMAT',
            query,
            options: {
              renameTo: 'level',
              originalLabel: levelLikeLabel,
            },
          },
        },
      });
    }
  }

  const hasLineFilter = isQueryWithLineFilter(query);

  if (!hasLineFilter) {
    hints.push({
      type: 'ADD_LINE_FILTER',
      label: 'Consider filtering logs for specific string.',
      fix: {
        title: 'add line filter',
        label: '',
        action: {
          type: 'ADD_LINE_FILTER',
          query,
        },
      },
    });
  }

  return hints;
}
