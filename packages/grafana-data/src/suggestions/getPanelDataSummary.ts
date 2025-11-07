import { PreferredVisualisationType } from '../types/data';
import { DataFrame, FieldType } from '../types/dataFrame';

import { PanelDataSummary } from './types';

/**
 * given dataframes, return a summary which can be used to help suggest visualizations
 * @param frames
 * @returns {PanelDataSummary} summarized info about the data frames
 */
export function getPanelDataSummary(frames: DataFrame[]): PanelDataSummary {
  let rowCountTotal = 0;
  let rowCountMax = 0;
  let fieldCount = 0;
  const countByType: Partial<Record<FieldType, number>> = {};
  let preferredVisualisationType: PreferredVisualisationType | undefined;

  for (const frame of frames) {
    rowCountTotal += frame.length;

    if (frame.meta?.preferredVisualisationType) {
      preferredVisualisationType = frame.meta.preferredVisualisationType;
    }

    for (const field of frame.fields) {
      fieldCount++;
      countByType[field.type] = (countByType[field.type] || 0) + 1;
    }

    if (frame.length > rowCountMax) {
      rowCountMax = frame.length;
    }
  }

  const countFieldType = (f: FieldType) => countByType[f] ?? 0;

  return {
    rowCountTotal,
    rowCountMax,
    fieldCount,
    preferredVisualisationType,
    frameCount: frames.length,
    hasData: rowCountTotal > 0,
    hasFieldType: (f: FieldType) => countFieldType(f) > 0,
    countFieldType,
    // deprecated
    numberFieldCount: countFieldType(FieldType.number),
    timeFieldCount: countFieldType(FieldType.time),
    stringFieldCount: countFieldType(FieldType.string),
    hasTimeField: countFieldType(FieldType.time) > 0,
    hasNumberField: countFieldType(FieldType.number) > 0,
    hasStringField: countFieldType(FieldType.string) > 0,
  };
}
