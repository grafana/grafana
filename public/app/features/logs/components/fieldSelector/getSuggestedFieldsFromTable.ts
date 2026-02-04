import { DataFrame } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getDistinctLabels } from 'app/features/transformers/utils';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { getSuggestedOTelDisplayFormat, OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from '../otel/formats';

import { FieldWithStats } from './FieldSelector';

export function getSuggestedFieldsFromTable(
  dataFrame: DataFrame,
  displayedFields: string[],
  defaultFields: string[] = []
) {
  const suggestedFields: FieldWithStats[] = defaultFields.map((field) => ({
    name: field,
    stats: {
      percentOfLinesWithLabel: 100,
    },
  }));

  // Doesn't currently work? @matyax
  if (config.featureToggles.otelLogsFormatting) {
    getSuggestedFieldsForTable(dataFrame).forEach((field) => {
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

/***
 * Given a list of logs, return a list of suggested fields to display for the user.
 */
export function getSuggestedFieldsForTable(dataFrame: DataFrame): string[] {
  const labels = getDistinctLabels([dataFrame]);
  const fields = getSuggestedOTelDisplayFormat();

  return fields.filter(
    (field) => field === LOG_LINE_BODY_FIELD_NAME || field === OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME || labels.has(field)
  );
}
