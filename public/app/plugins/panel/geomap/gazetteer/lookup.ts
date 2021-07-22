import { KeyValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { loadWorldmapPoints } from './worldmap';

// http://geojson.xyz/

export interface PlacenameInfo {
  coords: [number, number]; // lon, lat (WGS84)
  props?: Record<string, any>;
}

export interface Gazetteer {
  path: string;
  error?: string;
  find: (key: string) => PlacenameInfo | undefined;
  examples: (count: number) => string[];
}

// Without knowing the datatype pick a good lookup function
export function loadGazetteer(path: string, data: any): Gazetteer {
  // Check for legacy worldmap syntax
  if (Array.isArray(data)) {
    const first = data[0] as any;
    if (first.key && first.latitude) {
      return loadWorldmapPoints(path, data);
    }
  }

  // TODO: geojson? csv?

  return {
    path,
    error: 'Invalid lookup data',
    find: (k) => undefined,
    examples: (v) => [],
  };
}

const registry: KeyValue<Gazetteer> = {};

/**
 * Given a path to a file return a cached lookup function
 */
export function getGazetteer(path?: string): Gazetteer {
  // When not specified, use the default path
  if (!path) {
    path = 'placenames/countries.json';
  }

  let lookup = registry[path];
  if (!lookup) {
    try {
      // block the async function
      const data = (() => {
        return async () => {
          return await getBackendSrv().get(path!);
        };
      })();

      console.log('GOT RESPONSE', path, data);

      lookup = loadGazetteer(path, data);
    } catch (err) {
      console.warn('Error loading placename lookup', path, err);
      lookup = {
        path,
        error: 'Error loading URL',
        find: (k) => undefined,
        examples: (v) => [],
      };
    }
    registry[path] = lookup;
  }
  return lookup;
}
