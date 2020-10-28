import {
  CircularDataFrame,
  Labels,
  formatLabels,
  FieldType,
  DataFrame,
  matchAllLabels,
  parseLabels,
  CircularVector,
  ArrayVector,
} from '@grafana/data';
import { Measurement, MeasurementBatch, LiveMeasurements, MeasurementsQuery, MeasurementAction } from './types';

interface MeasurementCacheConfig {
  append?: 'head' | 'tail';
  capacity?: number;
}

/** This is a cache scoped to a the measurement name
 *
 * @alpha -- experimental
 */
export class MeasurementCache {
  readonly frames: Record<string, CircularDataFrame> = {}; // key is the labels

  constructor(public name: string, private config: MeasurementCacheConfig) {
    if (!this.config) {
      this.config = {
        append: 'tail',
        capacity: 600, // Default capacity 10min @ 1hz
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

  addMeasurement(m: Measurement, action: MeasurementAction): DataFrame {
    const key = m.labels ? formatLabels(m.labels) : '';
    let frame = this.frames[key];
    if (!frame) {
      frame = new CircularDataFrame(this.config);
      frame.name = this.name;
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
      this.frames[key] = frame;
    }

    // Clear existing values
    if (action === MeasurementAction.Replace) {
      for (const field of frame.fields) {
        (field.values as ArrayVector).buffer.length = 0; // same buffer, but reset to empty length
      }
    }

    // Add the timestamp
    frame.values['time'].add(m.time || Date.now());

    // Attach field config to the current fields
    if (m.config) {
      for (const [key, value] of Object.entries(m.config)) {
        const f = frame.fields.find(f => f.name === key);
        if (f) {
          f.config = value;
        }
      }
    }

    // Append all values (a row)
    for (const [key, value] of Object.entries(m.values)) {
      let v = frame.values[key];
      if (!v) {
        const f = frame.addFieldFor(value, key);
        f.labels = m.labels;
        v = f.values;
      }
      v.add(value);
    }

    // Make sure all fields have the same length
    frame.validate();
    return frame;
  }
}

/**
 * @alpha -- experimental
 */
export class MeasurementCollector implements LiveMeasurements {
  measurements = new Map<string, MeasurementCache>();
  config: MeasurementCacheConfig = {
    append: 'tail',
    capacity: 600, // Default capacity 10min @ 1hz
  };

  //------------------------------------------------------
  // Public
  //------------------------------------------------------

  getData(query?: MeasurementsQuery): DataFrame[] {
    const { name, labels, fields } = query || {};

    let data: DataFrame[] = [];
    if (name) {
      // for now we only match exact names
      const m = this.measurements.get(name);
      if (m) {
        data = m.getFrames(labels);
      }
    } else {
      for (const f of this.measurements.values()) {
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
    const m = this.measurements.get(name);
    if (m) {
      return Object.keys(m.frames).map(k => parseLabels(k));
    }
    return [];
  }

  setCapacity(size: number) {
    this.config.capacity = size;

    // Now update all the circular buffers
    for (const wrap of this.measurements.values()) {
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

  clear() {
    this.measurements.clear();
  }

  //------------------------------------------------------
  // Collector
  //------------------------------------------------------

  addBatch = (batch: MeasurementBatch) => {
    let action = batch.action ?? MeasurementAction.Append;
    if (action === MeasurementAction.Clear) {
      this.measurements.clear();
      action = MeasurementAction.Append;
    }

    // Change the local buffer size
    if (batch.capacity && batch.capacity !== this.config.capacity) {
      this.setCapacity(batch.capacity);
    }

    for (const measure of batch.measurements) {
      const name = measure.name || '';
      let m = this.measurements.get(name);
      if (!m) {
        m = new MeasurementCache(name, this.config);
        this.measurements.set(name, m);
      }
      if (measure.values) {
        m.addMeasurement(measure, action);
      } else {
        console.log('invalid measurement', measure);
      }
    }
    return this;
  };
}
