import { DataFrame, DataFrameFieldIndex } from '@grafana/data';

/**
 * @internal
 */
export type FieldIndex = number;

/**
 * @internal
 */
export type DimensionValues<T> = (frame: DataFrame, from?: number) => T | T[];

/**
 * each element in these dimension arrays represents a series
 *
 * @internal
 */
export interface FrameFieldMap {
  frameIndex: number;

  // field indices of interest e.g. filtered by FieldMatchers and/or mapped from Dimensions
  x: FieldIndex[];
  y: FieldIndex[];

  // field indices of interest in specific contexts
  tooltip?: Array<Array<DimensionValues<any> | FieldIndex>>;
  legend?: Array<Array<DimensionValues<any> | FieldIndex>>;
}

/**
 * @internal
 */
export interface FieldLookup<M extends FrameFieldMap = FrameFieldMap> {
  // frame-matched
  fieldMaps: M[];
  // maps displayName => DataFrameFieldIndex
  byName: Map<string, DataFrameFieldIndex>;
  // maps enumerated/flat seriesIndex => DataFrameFieldIndex
  byIndex: Map<number, DataFrameFieldIndex>;

  // util exposed to mutate field.state.seriesIndex of 'y' fields
  //   a. using 'y' fields of all frames (AlignedData)
  //   b. using frame's index (FacetedData)
  //
  // TODO: not sure if this should be here or external
  // will need to be run as part of fieldPrep on every data update
  // something like myPrepFieldLookup(frames) => {lookup: FieldLookup, enumerate: (frames: DataFrame[]) => void}
  setIndices: (frames: DataFrame[]) => void;
}
