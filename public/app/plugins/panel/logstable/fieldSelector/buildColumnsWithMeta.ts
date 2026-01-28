import { DataFrame, FieldWithIndex, getFieldDisplayName } from '@grafana/data';
import { FieldNameMeta, FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';

type FieldName = string;

export interface LogsFrameFields {
  extraFields: FieldWithIndex[];
  severityField: FieldWithIndex | null;
  bodyField: FieldWithIndex;
  timeField: FieldWithIndex;
}

// sync with logs version (or deprecate)
export const buildColumnsWithMeta = (
  logsFrameFields: LogsFrameFields,
  dataFrame: DataFrame,
  displayedFields: string[]
) => {
  const otherFields = [];
  const numberOfLogLines = logsFrameFields?.timeField.values.length;

  if (logsFrameFields.extraFields) {
    otherFields.push(...logsFrameFields.extraFields.filter((field) => !field?.config?.custom?.hidden));
  }
  if (logsFrameFields?.severityField) {
    otherFields.push(logsFrameFields?.severityField);
  }
  if (logsFrameFields?.bodyField) {
    otherFields.push(logsFrameFields?.bodyField);
  }
  if (logsFrameFields?.timeField) {
    otherFields.push(logsFrameFields?.timeField);
  }

  // Use a map to dedupe labels and count their occurrences in the logs
  const labelCardinality = new Map<FieldName, FieldNameMeta>();

  // What the label state will look like
  let pendingLabelState: FieldNameMetaStore = {};

  // If we have labels and log lines
  if (dataFrame.fields.length && numberOfLogLines) {
    // Iterate through all of fields
    dataFrame.fields.forEach((field) => {
      const fieldName = getFieldDisplayName(field);
      // Count the valid values
      const countOfValues = field.values.reduce((acc: number, value) => {
        if (value !== undefined && value !== null) {
          return acc + 1;
        }
        return acc;
      }, 0);

      // @todo rename percentOfLinesWithLabel before normalization
      labelCardinality.set(fieldName, {
        percentOfLinesWithLabel: countOfValues,
        active: false,
        index: undefined,
      });
    });

    // Converting the map to an object
    pendingLabelState = Object.fromEntries(labelCardinality);

    // Convert count to percent of log lines
    Object.keys(pendingLabelState).forEach((key) => {
      pendingLabelState[key].percentOfLinesWithLabel = normalize(
        pendingLabelState[key].percentOfLinesWithLabel,
        numberOfLogLines
      );
    });
  }

  // Normalize the other fields
  otherFields.forEach((field) => {
    const fieldName = getFieldDisplayName(field);
    const isActive = pendingLabelState[fieldName]?.active;
    const index = pendingLabelState[fieldName]?.index;
    if (isActive && index !== undefined) {
      pendingLabelState[fieldName] = {
        percentOfLinesWithLabel: normalize(
          field.values.filter((value) => value !== null && value !== undefined).length,
          numberOfLogLines
        ),
        active: true,
        index: index,
      };
    } else {
      pendingLabelState[fieldName] = {
        percentOfLinesWithLabel: normalize(
          field.values.filter((value) => value !== null && value !== undefined).length,
          numberOfLogLines
        ),
        active: false,
        index: undefined,
      };
    }
  });

  displayedFields.forEach((fieldName, idx) => {
    if (pendingLabelState[fieldName]) {
      pendingLabelState[fieldName].active = true;
      pendingLabelState[fieldName].index = idx;
    } else {
      console.error(`Unknown field ${fieldName}`, { pendingLabelState, displayedFields });
    }
  });

  // If nothing is selected, then select the default columns
  if (displayedFields.length === 0) {
    if (logsFrameFields?.bodyField?.name) {
      pendingLabelState[logsFrameFields.bodyField.name].active = true;
    }
    if (logsFrameFields?.timeField?.name) {
      pendingLabelState[logsFrameFields.timeField.name].active = true;
    }
  }

  if (logsFrameFields?.bodyField?.name && logsFrameFields?.timeField?.name) {
    pendingLabelState[logsFrameFields.bodyField.name].type = 'BODY_FIELD';
    pendingLabelState[logsFrameFields.timeField.name].type = 'TIME_FIELD';
  }

  return pendingLabelState;
};

const normalize = (value: number, total: number): number => {
  return Math.ceil((100 * value) / total);
};
