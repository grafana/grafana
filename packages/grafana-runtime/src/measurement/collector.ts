import { DataFrame, DataFrameJSON, StreamingDataFrame, StreamingFrameOptions } from '@grafana/data';
import { LiveMeasurements, MeasurementsQuery } from './types';

/**
 * This will collect
 *
 * @alpha -- experimental
 */
export class MeasurementCollector implements LiveMeasurements {
  frame?: StreamingDataFrame;
  config: StreamingFrameOptions = {
    maxLength: 600, // Default capacity 10min @ 1hz
  };

  //------------------------------------------------------
  // Public
  //------------------------------------------------------

  getData(query?: MeasurementsQuery): DataFrame[] {
    if (!this.frame) {
      return [];
    }
    const { fields } = query || {};
    if (fields?.length) {
      const match = this.frame.fields.filter((f) => fields.includes(f.name));
      if (match.length > 0) {
        return [{ ...this.frame, fields: match, length: this.frame.length }]; // Copy the frame with fewer fields
      }
      return [];
    }
    return [this.frame];
  }

  ensureCapacity(size: number) {
    // TODO...
  }

  getKeys(): string[] {
    return [];
  }

  //------------------------------------------------------
  // Collector
  //------------------------------------------------------

  append = (measure: DataFrameJSON) => {
    if (!this.frame) {
      this.frame = new StreamingDataFrame(measure, this.config);
    } else {
      this.frame.push(measure);
    }
    return this;
  };
}
