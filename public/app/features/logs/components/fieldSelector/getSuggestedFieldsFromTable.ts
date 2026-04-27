import { type DataFrame } from '@grafana/data/dataframe';
import { getDistinctLabels } from 'app/features/transformers/utils';

import { getSuggestedOTelDisplayFormat } from '../otel/formats';

import { type FieldWithStats } from './FieldSelector';
import { LOG_LINE_BODY_FIELD_NAME, OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from './logFields';

export function getSuggestedFieldsFromTable(_: DataFrame, displayedFields: string[], defaultFields: string[] = []) {
  const suggestedFields: FieldWithStats[] = defaultFields.map((field) => ({
    name: field,
    stats: {
      percentOfLinesWithLabel: 100,
    },
  }));

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
