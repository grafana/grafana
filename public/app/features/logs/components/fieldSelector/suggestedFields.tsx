import { config } from '@grafana/runtime';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { getSuggestedFieldsForLogs } from '../otel/formats';
import { LogListModel } from '../panel/processing';

import { FieldWithStats } from './FieldSelector';

/**
 *
 * @param logs
 * @param displayedFields
 * @param defaultFields
 */
export function getSuggestedFieldsFromLogList(
  logs: LogListModel[],
  displayedFields: string[],
  defaultFields: string[] = []
) {
  const suggestedFields: FieldWithStats[] = defaultFields.map((field) => ({
    name: field,
    stats: {
      percentOfLinesWithLabel: 100,
    },
  }));

  if (config.featureToggles.otelLogsFormatting) {
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
