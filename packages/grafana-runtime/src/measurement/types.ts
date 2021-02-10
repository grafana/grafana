import { DataFrame, DataFrameJSON } from '@grafana/data';

/**
 * List of Measurements sent in a batch
 *
 * @alpha -- experimental
 */
export interface MeasurementBatch {
  /**
   * List of measurements to process
   */
  batch: DataFrameJSON[];
}

/**
 * @alpha -- experimental
 */
export interface MeasurementsQuery {
  key?: string;
  fields?: string[]; // only include the fields with these names
}

/**
 * Channels that receive Measurements can collect them into frames
 *
 * @alpha -- experimental
 */
export interface LiveMeasurements {
  getData(query?: MeasurementsQuery): DataFrame[];
  getKeys(): string[];
  ensureCapacity(size: number): void;
}
