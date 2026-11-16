import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';

import { FieldType, toDataFrame } from '@grafana/data';

import { type PlacenameInfo, type Gazetteer } from './gazetteer';

// https://github.com/grafana/worldmap-panel/blob/master/src/data/countries.json
export interface WorldmapPoint {
  key?: string;
  keys?: string[]; // new in grafana 8.1+
  latitude: number;
  longitude: number;
  name?: string;
}

export function loadWorldmapPoints(path: string, data: WorldmapPoint[]): Gazetteer {
  // The field lookup transform reads values out of a frame, so expose the points as one too.
  // Field names match what frameAsGazetter recognises, so the frame round-trips as a gazetteer.
  const frame = toDataFrame({
    fields: [
      { name: 'id', type: FieldType.string, values: data.map((v) => v.key ?? v.keys?.[0]) },
      { name: 'name', type: FieldType.string, values: data.map((v) => v.name) },
      { name: 'lng', type: FieldType.number, values: data.map((v) => v.longitude) },
      { name: 'lat', type: FieldType.number, values: data.map((v) => v.latitude) },
    ],
  });

  const values = new Map<string, PlacenameInfo>();
  let index = 0;
  for (const v of data) {
    const point = new Point(fromLonLat([v.longitude, v.latitude]));
    const info: PlacenameInfo = {
      point: () => point,
      geometry: () => point,
      frame,
      index,
    };
    if (v.name) {
      values.set(v.name, info);
      values.set(v.name.toUpperCase(), info);
    }
    if (v.key) {
      values.set(v.key, info);
      values.set(v.key.toUpperCase(), info);
    }
    if (v.keys) {
      for (const key of v.keys) {
        values.set(key, info);
        values.set(key.toUpperCase(), info);
      }
    }
    index++;
  }
  return {
    path,
    find: (k) => {
      let v = values.get(k);
      if (!v && typeof k === 'string') {
        v = values.get(k.toUpperCase());
      }
      return v;
    },
    frame: () => frame,
    count: frame.length,
    examples: (count) => {
      const first: string[] = [];
      if (values.size < 1) {
        first.push('no values found');
      } else {
        for (const key of values.keys()) {
          first.push(key);
          if (first.length >= count) {
            break;
          }
        }
      }
      return first;
    },
  };
}
