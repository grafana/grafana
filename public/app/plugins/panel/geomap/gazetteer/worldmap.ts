import { PlacenameInfo, PlacenameLookup } from './lookup';

// https://github.com/grafana/worldmap-panel/blob/master/src/data/countries.json
export interface WorldmapPoint {
  key: string;
  latitude: number;
  longitude: number;
  name: number;
}

export function loadWorldmapPoints(path: string, data: WorldmapPoint[]): PlacenameLookup {
  const values = new Map<string, PlacenameInfo>();
  for (const v of data) {
    values.set(v.key, {
      coords: [v.longitude, v.latitude],
      props: {
        name: v.name,
      },
    });
  }
  return {
    path,
    find: (k) => values.get(k),
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
