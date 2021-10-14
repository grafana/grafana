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
  console.log('TODO read', data);
  let count = 0;
  const values = new Map<string, PlacenameInfo>();
  // for (const v of data) {
  //   const info: PlacenameInfo = {
  //     coords: [v.longitude, v.latitude],
  //   };
  //   if (v.name) {
  //     values.set(v.name, info);
  //     values.set(v.name.toUpperCase(), info);
  //     info.props = { name: v.name };
  //   }
  //   if (v.key) {
  //     values.set(v.key, info);
  //     values.set(v.key.toUpperCase(), info);
  //   }
  //   if (v.keys) {
  //     for (const key of v.keys) {
  //       values.set(key, info);
  //       values.set(key.toUpperCase(), info);
  //     }
  //   }
  //   count++;
  // }
  return {
    path,
    find: (k) => {
      let v = values.get(k);
      if (!v) {
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
