import { MapLayerRegistryItem, MapLayerConfig, MapLayerHandler, PanelData, Field } from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as style from 'ol/style';
import * as source from 'ol/source';
import * as layer from 'ol/layer';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';

export interface DynamicLayerOptions {
  token?: string;
}

export function newDynamicLayerHandler(map: Map, options: MapLayerConfig<DynamicLayerOptions>): MapLayerHandler {
  const madrid = new Feature({});

  madrid.setStyle(
    new style.Style({
      image: new style.Icon({
        src: 'https://openlayers.org/en/latest/examples/data/icon.png',
      }),
    })
  );

  const vectorSource = new source.Vector({
    features: [madrid],
  });

  const vectorLayer = new layer.Vector({
    source: vectorSource,
  });

  return {
    init: () => vectorLayer,
    update: (map: Map, data: PanelData) => {
      const frame = data.series[0];
      if (frame && frame.length) {
        let lat: Field | undefined = undefined;
        let lng: Field | undefined = undefined;
        for (const field of frame.fields) {
          if (field.name === 'lat') {
            lat = field;
          } else if (field.name === 'lng') {
            lng = field;
          }
        }

        if (lat && lng) {
          const idx = lat.values.length - 1;
          const latV = lat.values.get(idx);
          const lngV = lng.values.get(idx);
          if (latV != null && lngV != null) {
            madrid.setGeometry(new Point(fromLonLat([lngV, latV])));
          }
        }
      }
    },
  };
}

export const dynamic: MapLayerRegistryItem<DynamicLayerOptions> = {
  id: 'dynamic-data',
  name: 'Dynamic data',
  isBaseMap: false,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: newDynamicLayerHandler,
};

export const defaultFrameConfig: MapLayerConfig<DynamicLayerOptions> = {
  type: dynamic.id,
};

export const dynamicLayers = [dynamic];
