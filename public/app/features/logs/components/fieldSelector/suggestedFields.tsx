import { getSuggestedFieldsForLogs } from '../otel/formats';
import { type LogListModel } from '../panel/processing';

import { type FieldWithStats } from './FieldSelector';
import { LOG_LINE_BODY_FIELD_NAME } from './logFields';

/**
 * Builds suggested fields list from logs and defaults.
 *
 * @param logs
 * @param displayedFields
 * @param defaultFields
 * @param otelLogsFormattingEnabled
 */
export function getSuggestedFieldsFromLogList(
  logs: LogListModel[],
  displayedFields: string[],
  defaultFields: string[] = [],
  otelLogsFormattingEnabled = false
) {
  const suggestedFields: FieldWithStats[] = defaultFields.map((field) => ({
    name: field,
    stats: {
      percentOfLinesWithLabel: 100,
    },
  }));

  if (otelLogsFormattingEnabled) {
    getSuggestedFieldsForLogs(logs).forEach((field) => {
      suggestedFields.push({
        name: field,
        stats: {
          percentOfLinesWithLabel: 100,
        },
      });
    });
  }

  if (
    !defaultFields.length &&
    displayedFields.length &&
    !suggestedFields.find((field) => field.name === LOG_LINE_BODY_FIELD_NAME)
  ) {
    suggestedFields.push({
      name: LOG_LINE_BODY_FIELD_NAME,
      stats: {
        percentOfLinesWithLabel: 100,
      },
    });
  }

  return suggestedFields;
}
