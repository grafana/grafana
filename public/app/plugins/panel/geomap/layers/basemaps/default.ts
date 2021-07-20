import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';
import { carto } from './carto';
import { esriXYZTiles } from './esri';
import { xyzTiles } from './generic';
import { standard } from './osm';

const settings = (window as any).grafanaBootData.settings;

// TODO!!!
const basemapOptions = [carto, esriXYZTiles, xyzTiles, standard];
interface XYZProvisioned {
  url: string;
  attribution: string;
}

const defaultXYZProvisioned: XYZProvisioned = {
  url: settings.geomapDefaultBaseLayer.config.url,
  attribution: settings.geomapDefaultBaseLayer.config.attribution,
};

export var defaultBaseLayer: MapLayerRegistryItem<any>;

if (settings.geomapDefaultBaseLayer) {
  defaultBaseLayer = basemapOptions.find((baseLayer) => baseLayer.id === settings.geomapDefaultBaseLayer.type)!;
} else {
  defaultBaseLayer = carto;
}
if (defaultBaseLayer.id === 'xyz') {
  defaultBaseLayer = {
    id: 'config',
    name: 'Configured Tile layer',
    isBaseMap: true,

    create: (map: Map, options: MapLayerOptions<XYZProvisioned>, theme: GrafanaTheme2) => ({
      init: () => {
        return new TileLayer({
          source: new XYZ({
            url: defaultXYZProvisioned.url,
            attributions: defaultXYZProvisioned.attribution,
          }),
        });
      },
    }),
  };
}
