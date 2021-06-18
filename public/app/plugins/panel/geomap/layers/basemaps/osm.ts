import { MapLayerRegistryItem, MapLayerConfig } from '@grafana/data';
import L from 'leaflet';

const mapnik: MapLayerRegistryItem = {
  id: 'osm-mapnik',
  name: 'Open Street Map - Mapnik',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (options: MapLayerConfig) => ({
    init: () => {
      return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });
    },
  }),
};

const topo: MapLayerRegistryItem = {
  id: 'opentopo',
  name: 'Opentopo',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (options: MapLayerConfig) => ({
    init: () => {
      return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution:
          'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
      });
    },
  }),
};

export const osmLayers = [mapnik, topo];
