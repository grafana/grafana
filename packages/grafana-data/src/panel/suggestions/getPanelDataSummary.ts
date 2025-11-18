import { PreferredVisualisationType } from '../../types/data';
import { DataFrame, FieldType } from '../../types/dataFrame';

/**
 * @alpha
 */
export interface PanelDataSummary {
  hasData?: boolean;
  rowCountTotal: number;
  /** max number of rows in any given dataframe in the panel data */
  rowCountMax: number;
  frameCount: number;
  fieldCount: number;
  /** max number of fields in any given dataframe in the panel data */
  fieldCountMax: number;
  fieldCountByType: (type: FieldType) => number;
  hasFieldType: (type: FieldType) => boolean;
  /** The first frame that set's this value */
  preferredVisualisationType?: PreferredVisualisationType;
  /** pass along a reference to the raw data in case it's needed by the plugin */
  _data?: DataFrame[];
  /* --- DEPRECATED FIELDS BELOW --- */
  /** @deprecated use PanelDataSummary.fieldCountByType(FieldType.number) */
  numberFieldCount: number;
  /** @deprecated use PanelDataSummary.fieldCountByType(FieldType.time) */
  timeFieldCount: number;
  /** @deprecated use PanelDataSummary.fieldCountByType(FieldType.string) */
  stringFieldCount: number;
  /** @deprecated use PanelDataSummary.hasFieldType(FieldType.number) */
  hasNumberField?: boolean;
  /** @deprecated use PanelDataSummary.hasFieldType(FieldType.time) */
  hasTimeField?: boolean;
  /** @deprecated use PanelDataSummary.hasFieldType(FieldType.string) */
  hasStringField?: boolean;
}

/**
 * @alpha
 * given a list of dataframes, summarize attributes of those frames for features like suggestions.
 * @param frames - dataframes to summarize
 * @returns summary of the dataframes
 */
export function getPanelDataSummary(frames?: DataFrame[]): PanelDataSummary {
  let rowCountTotal = 0;
  let rowCountMax = 0;
  let fieldCount = 0;
  let fieldCountMax = 0;
  const countByType: Partial<Record<FieldType, number>> = {};
  let preferredVisualisationType: PreferredVisualisationType | undefined;

  for (const frame of frames ?? []) {
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
    if (frame.fields.length > fieldCountMax) {
      fieldCountMax = frame.fields.length;
    }
  }

  const fieldCountByType = (f: FieldType) => countByType[f] ?? 0;

  return {
    rowCountTotal,
    rowCountMax,
    fieldCount,
    fieldCountMax,
    preferredVisualisationType,
    frameCount: frames?.length ?? 0,
    hasData: rowCountTotal > 0,
    hasFieldType: (f: FieldType) => fieldCountByType(f) > 0,
    fieldCountByType,
    _data: frames,
    // deprecated
    numberFieldCount: fieldCountByType(FieldType.number),
    timeFieldCount: fieldCountByType(FieldType.time),
    stringFieldCount: fieldCountByType(FieldType.string),
    hasTimeField: fieldCountByType(FieldType.time) > 0,
    hasNumberField: fieldCountByType(FieldType.number) > 0,
    hasStringField: fieldCountByType(FieldType.string) > 0,
  };
}
