import { LOG_LINE_BODY_FIELD_NAME } from 'app/features/logs/components/LogDetailsBody';

import { FieldWithStats } from './FieldSelector';

export function getSuggestedFields(displayedFields: string[], defaultFields: string[] = []) {
  const suggestedFields: FieldWithStats[] = defaultFields.map((field) => ({
    name: field,
    stats: {
      percentOfLinesWithLabel: 100,
    },
  }));

  // @todo cannot use LogListModel
  // if (config.featureToggles.otelLogsFormatting) {
  //   getSuggestedFieldsForLogs(logs).forEach((field) => {
  //     suggestedFields.push({
  //       name: field,
  //       stats: {
  //         percentOfLinesWithLabel: 100,
  //       },
  //     });
  //   });
  // }

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
