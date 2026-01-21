import { FieldWithIndex, getFieldDisplayName, Labels } from '@grafana/data';
import { FieldNameMeta, FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';

type FieldName = string;

export interface LogsFrameFields {
  extraFields: FieldWithIndex[];
  severityField: FieldWithIndex | null;
  bodyField: FieldWithIndex;
  timeField: FieldWithIndex;
}

export const buildColumnsWithMeta = (
  logsFrameFields: LogsFrameFields,
  labels: Labels[] | null,
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
  if (labels?.length && numberOfLogLines) {
    // Iterate through all of Labels
    labels.forEach((labels: Labels) => {
      const labelsArray = Object.keys(labels);
      // Iterate through the label values
      labelsArray.forEach((label) => {
        // If it's already in our map, increment the count
        if (labelCardinality.has(label)) {
          const value = labelCardinality.get(label);
          if (value) {
            if (value?.active) {
              labelCardinality.set(label, {
                percentOfLinesWithLabel: value.percentOfLinesWithLabel + 1,
                active: true,
                index: value.index,
              });
            } else {
              labelCardinality.set(label, {
                percentOfLinesWithLabel: value.percentOfLinesWithLabel + 1,
                active: false,
                index: undefined,
              });
            }
          }
          // Otherwise add it
        } else {
          labelCardinality.set(label, { percentOfLinesWithLabel: 1, active: false, index: undefined });
        }
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
    const fieldName = field.name ?? getFieldDisplayName(field);
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
    pendingLabelState[fieldName].active = true;
    pendingLabelState[fieldName].index = idx;
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
