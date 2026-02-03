import { DataFrame } from '@grafana/data';
import { config } from '@grafana/runtime';
import { LOG_LINE_BODY_FIELD_NAME } from 'app/features/logs/components/LogDetailsBody';
import { FieldWithStats } from 'app/features/logs/components/fieldSelector/FieldSelector';
import {
  getSuggestedOTelDisplayFormat,
  OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME,
} from 'app/features/logs/components/otel/formats';
import { getDistinctLabels } from 'app/features/transformers/utils';

// Adapted /app/features/logs/components/fieldSelector/FieldSelector.tsx to work with dataframes instead of LogRowModel
export function getSuggestedFields(dataFrame: DataFrame, displayedFields: string[], defaultFields: string[] = []) {
  const suggestedFields: FieldWithStats[] = defaultFields.map((field) => ({
    name: field,
    stats: {
      percentOfLinesWithLabel: 100,
    },
  }));

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
