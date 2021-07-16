import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';

export interface XYZProvisioned {
  url: string;
  attribution: string;
}

const settings = (window as any).grafanaBootData.settings;
const url = settings.tileServerURL;
const attributionName = settings.tileServerAttribtuionName;
const attributionLink = settings.tileServerAttribtuionLink;
export const defaultXYZProvisioned: XYZProvisioned = {
  url: url,
  attribution: `Tiles © <a href="${attributionLink}">${attributionName}</a>`,
};

export const provision: MapLayerRegistryItem<XYZProvisioned> = {
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
