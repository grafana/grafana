import GeoJSON from 'ol/format/GeoJSON';
import { PlacenameInfo, Gazetteer } from './gazetteer';

export interface GeoJSONPoint {
  key?: string;
  keys?: string[]; // new in grafana 8.1+
  latitude: number;
  longitude: number;
  name?: string;
}

export function loadFromGeoJSON(path: string, body: any): Gazetteer {
  const data = new GeoJSON().readFeatures(body);
  let count = 0;
  const values = new Map<string, PlacenameInfo>();
  for (const f of data) {
    const coords = f.getGeometry().getFlatCoordinates(); //for now point, eventually geometry
    const info: PlacenameInfo = {
      coords: coords,
    };
    const id = f.getId();
    if (id) {
      if (typeof id === 'number') {
        values.set(id.toString(), info);
      } else {
        values.set(id, info);
        values.set(id.toUpperCase(), info);
      }
    }
    const properties = f.getProperties();
    if (properties) {
      for (const k of Object.keys(properties)) {
        if (k.includes('_code') || k.includes('_id')) {
          const value = properties[k];
          if (value) {
            if (typeof value === 'number') {
              values.set(value.toString(), info);
            } else {
              values.set(value, info);
              values.set(value.toUpperCase(), info);
            }
          }
        }
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
