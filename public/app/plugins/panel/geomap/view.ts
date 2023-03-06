import { Registry, RegistryItem } from '@grafana/data';

interface MapCenterItems extends RegistryItem {
  lat?: number;
  lon?: number;
  zoom?: number;
}

export enum MapCenterID {
  Zero = 'zero',
  Coordinates = 'coords',
  Fit = 'fit',
}

export const centerPointRegistry = new Registry<MapCenterItems>(() => [
  {
    id: MapCenterID.Fit,
    name: 'Fit to data',
    zoom: 15, // max zoom
  },
  {
    id: MapCenterID.Zero,
    name: '(0°, 0°)',
    lat: 0,
    lon: 0,
  },
  {
    id: MapCenterID.Coordinates,
    name: 'Coordinates',
  },
  {
    id: 'north-america',
    name: 'North America',
    lat: 40,
    lon: -100,
    zoom: 4,
  },
  {
    id: 'south-america',
    name: 'South America',
    lat: -20,
    lon: -60,
    zoom: 3,
  },
  {
    id: 'europe',
    name: 'Europe',
    lat: 46,
    lon: 14,
    zoom: 4,
  },
  {
    id: 'africa',
    name: 'Africa',
    lat: 0,
    lon: 30,
    zoom: 3,
  },
  {
    id: 'west-asia',
    name: 'West Asia',
    lat: 26,
    lon: 53,
    zoom: 4,
  },
  {
    id: 's-asia',
    name: 'South Asia',
    lat: 19.5,
    lon: 80,
    zoom: 4,
  },
  {
    id: 'se-asia',
    name: 'South-East Asia',
    lat: 10,
    lon: 106,
    zoom: 4,
  },
  {
    id: 'e-asia',
    name: 'East Asia',
    lat: 33,
    lon: 120,
    zoom: 4,
  },
  {
    id: 'australia',
    name: 'Australia',
    lat: -25,
    lon: 135,
    zoom: 4,
  },
  {
    id: 'oceania',
    name: 'Oceania',
    lat: -10,
    lon: -140,
    zoom: 3,
  },
]);
