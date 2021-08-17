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
  count?: number;
  examples: (count: number) => string[];
}

// Without knowing the datatype pick a good lookup function
export function loadGazetteer(path: string, data: any): Gazetteer {
  // Check for legacy worldmap syntax
  if (Array.isArray(data)) {
    const first = data[0] as any;
    if (first.latitude && first.longitude && (first.key || first.keys)) {
      return loadWorldmapPoints(path, data);
    }
  }

  return {
    path,
    error: 'Unable to parse locations',
    find: (k) => undefined,
    examples: (v) => [],
  };
}

const registry: KeyValue<Gazetteer> = {};

export const COUNTRIES_GAZETTEER_PATH = 'public/gazetteer/countries.json';

/**
 * Given a path to a file return a cached lookup function
 */
export async function getGazetteer(path?: string): Promise<Gazetteer> {
  // When not specified, use the default path
  if (!path) {
    path = COUNTRIES_GAZETTEER_PATH;
  }

  let lookup = registry[path];
  if (!lookup) {
    try {
      // block the async function
      const data = await getBackendSrv().get(path!);
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
