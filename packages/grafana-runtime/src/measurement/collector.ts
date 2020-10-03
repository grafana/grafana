import {
  CircularDataFrame,
  Labels,
  formatLabels,
  FieldType,
  DataFrame,
  matchAllLabels,
  parseLabels,
  CircularVector,
} from '@grafana/data';
import { Measurement, MeasurementBatch, LiveMeasurements, MeasurementsQuery } from './types';

interface MeasurmentCacheConfig {
  append?: 'head' | 'tail';
  capacity?: number;
}

/** This is a cache scoped to a the measurement name */
export class MeasurmentCache {
  readonly frames: Record<string, CircularDataFrame> = {}; // key is the labels

  constructor(public name: string, private config: MeasurmentCacheConfig) {
    if (!this.config) {
      this.config = {
        append: 'tail',
        capacity: 1000,
      };
    }
  }

  getFrames(match?: Labels): DataFrame[] {
    const frames = Object.values(this.frames);
    if (!match) {
      return frames;
    }
    return frames.filter(f => {
      return matchAllLabels(match, f.meta?.custom?.labels);
    });
  }

  addMeasurement(m: Measurement): DataFrame {
    const key = m.labels ? formatLabels(m.labels) : '';
    let frame = this.frames[key];
    if (!frame) {
      frame = new CircularDataFrame(this.config);
      frame.addField({
        name: 'time',
        type: FieldType.time,
      });
      for (const [key, value] of Object.entries(m.values)) {
        frame.addFieldFor(value, key).labels = m.labels;
      }
      frame.meta = {
        custom: {
          labels: m.labels,
        },
      };
    }

    // Append the row
    for (const [key, value] of Object.entries(m.values)) {
      let v = frame.values[key];
      if (!v) {
        const f = frame.addFieldFor(value, key);
        f.labels = m.labels;
        v = f.values;
      }
      v.add(value);
    }
    // This will make sure everything has the same length
    frame.validate();
    return frame;
  }
}

export class MeasurementCollector implements LiveMeasurements {
  measurements: Record<string, MeasurmentCache> = {};
  config: MeasurmentCacheConfig = {
    append: 'tail',
    capacity: 1000,
  };

  //------------------------------------------------------
  // Public
  //------------------------------------------------------

  getData(query?: MeasurementsQuery): DataFrame[] {
    const { name, labels, fields } = query || {};

    let data: DataFrame[] = [];
    if (name) {
      // for now we only match exact names
      const m = this.measurements[name];
      if (m) {
        data = m.getFrames(labels);
      }
    } else {
      for (const f of Object.values(this.measurements)) {
        data.push.apply(data, f.getFrames(labels));
      }
    }

    if (fields && fields.length) {
      let filtered: DataFrame[] = [];
      for (const frame of data) {
        const match = frame.fields.filter(f => fields.includes(f.name));
        if (match.length > 0) {
          filtered.push({ ...frame, fields: match }); // Copy the frame with fewer fields
        }
      }
    }
    return data;
  }

  getDistinctNames(): string[] {
    return Object.keys(this.measurements);
  }

  getDistinctLabels(name: string): Labels[] {
    const m = this.measurements[name];
    if (m) {
      return Object.keys(m.frames).map(k => parseLabels(k));
    }
    return [];
  }

  setCapacity(size: number) {
    this.config.capacity = size;

    // Now update all the circular buffers
    for (const wrap of Object.values(this.measurements)) {
      for (const frame of Object.values(wrap.frames)) {
        for (const field of frame.fields) {
          (field.values as CircularVector).setCapacity(size);
        }
      }
    }
  }

  getCapacity() {
    return this.config.capacity!;
  }

  //------------------------------------------------------
  // Collector
  //------------------------------------------------------
  addBatch = (batch: MeasurementBatch) => {
    if (!batch.measures) {
      console.log('unknown message type:', batch);
      return;
    }

    for (const measure of batch.measures) {
      const name = measure.name || '';
      let m = this.measurements[name];
      if (!m) {
        m = this.measurements[name] = new MeasurmentCache(name, this.config);
      }
      if (measure.values) {
        m.addMeasurement(measure);
      } else {
        console.log('invalid measurment', measure);
      }
    }
    return this;
  };
}
