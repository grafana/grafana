import { getFieldDisplayName, Labels } from '@grafana/data';

import { FieldNameMeta, FieldNameMetaStore } from '../../../features/explore/Logs/LogsTableWrap';
import { LogsFrame } from '../../../features/logs/logsFrame';
type FieldName = string;

export const buildColumnsWithMeta = (logsFrame: LogsFrame, numberOfLogLines: number, displayedFields: string[]) => {
  const labels = logsFrame?.getLogFrameLabelsAsLabels();

  const otherFields = [];

  if (logsFrame) {
    otherFields.push(...logsFrame.extraFields.filter((field) => !field?.config?.custom?.hidden));
  }
  if (logsFrame?.severityField) {
    otherFields.push(logsFrame?.severityField);
  }
  if (logsFrame?.bodyField) {
    otherFields.push(logsFrame?.bodyField);
  }
  if (logsFrame?.timeField) {
    otherFields.push(logsFrame?.timeField);
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
    if (logsFrame?.bodyField?.name) {
      pendingLabelState[logsFrame.bodyField.name].active = true;
    }
    if (logsFrame?.timeField?.name) {
      pendingLabelState[logsFrame.timeField.name].active = true;
    }
  }

  if (logsFrame?.bodyField?.name && logsFrame?.timeField?.name) {
    pendingLabelState[logsFrame.bodyField.name].type = 'BODY_FIELD';
    pendingLabelState[logsFrame.timeField.name].type = 'TIME_FIELD';
  }

  return pendingLabelState;
};

const normalize = (value: number, total: number): number => {
  return Math.ceil((100 * value) / total);
};
