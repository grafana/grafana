import { DataFrame, Labels } from '@grafana/data';

/**
 * the raw channel events are batches of Measurements
 *
 * @experimental
 */
export interface Measurement {
  name: string;
  time?: number; // Missing will use the browser time
  values: Record<string, any>;
  labels?: Labels;
}

/**
 * List of Measurements sent in a batch
 *
 * @experimental
 */
export interface MeasurementBatch {
  measures: Measurement[];
}

export interface MeasurementsQuery {
  name?: string;
  labels?: Labels;
  fields?: string[]; // only include the fields with these names
}

/**
 * Channels that recieve Measurements can collect them into frames
 *
 * @experimental
 */
export interface LiveMeasurements {
  getData(query?: MeasurementsQuery): DataFrame[];
  getDistinctNames(): string[];
  getDistinctLabels(name: string): Labels[];
  setCapacity(size: number): void;
  getCapacity(): number;
}
