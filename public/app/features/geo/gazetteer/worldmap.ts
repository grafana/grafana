import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';

import { PlacenameInfo, Gazetteer } from './gazetteer';

// https://github.com/grafana/worldmap-panel/blob/master/src/data/countries.json
export interface WorldmapPoint {
  key?: string;
  keys?: string[]; // new in grafana 8.1+
  latitude: number;
  longitude: number;
  name?: string;
}

export function loadWorldmapPoints(path: string, data: WorldmapPoint[]): Gazetteer {
  let count = 0;
  const values = new Map<string, PlacenameInfo>();
  for (const v of data) {
    const point = new Point(fromLonLat([v.longitude, v.latitude]));
    const info: PlacenameInfo = {
      point: () => point,
      geometry: () => point,
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
    count++;
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
    count,
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
