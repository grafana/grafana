import { Registry, RegistryItem } from '@grafana/data';

interface MapCenterItems extends RegistryItem {
  lat?: number;
  lon?: number;
}

export enum MapCenterID {
  Zero = 'zero',
  Coordinates = 'coords',
  LastPoint = 'last',
}

export const centerPointRegistry = new Registry<MapCenterItems>(() => [
  {
    id: MapCenterID.Zero as string,
    name: '(0°, 0°)',
    lat: 0,
    lon: 0,
  },
  {
    id: 'north-america',
    name: 'North America',
    lat: 40,
    lon: -100,
  },
  {
    id: 'europe',
    name: 'Europe',
    lat: 46,
    lon: 14,
  },
  {
    id: 'west-asia',
    name: 'West Asia',
    lat: 26,
    lon: 53,
  },
  {
    id: 'se-asia',
    name: 'South-east Asia',
    lat: 10,
    lon: 106,
  },
  {
    id: MapCenterID.Coordinates as string,
    name: 'Coordinates',
  },
  {
    id: MapCenterID.LastPoint as string,
    name: 'Last value',
  },
]);
