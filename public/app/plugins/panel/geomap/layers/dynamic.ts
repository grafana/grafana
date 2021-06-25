import { MapLayerRegistryItem, MapLayerConfig, MapLayerHandler, PanelData, Field } from '@grafana/data';
import L from 'leaflet';

export interface DynamicLayerOptions {
  token?: string;
}

export function newDynamicLayerHandler(options: MapLayerConfig<DynamicLayerOptions>): MapLayerHandler {
  const smallIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-icon-2x.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    shadowSize: [41, 41],
  });

  let marker: L.Marker | undefined = undefined;
  const layer = L.layerGroup([]);
  layer.clearLayers();

  // const layer = L.geoJSON(undefined, {
  //   pointToLayer: function (feature, latlng) {
  //     console.log(latlng, feature);
  //     return L.marker(latlng, {
  //       icon: smallIcon,
  //     });
  //   },
  //   onEachFeature: (feature, layer) => {
  //     console.log(feature);
  //     layer.bindPopup('hello');
  //   },

  //   // Don't use default shape
  //   markersInheritOptions: false,
  // });

  // const geojsonFeature: Feature = {
  //   type: 'Feature',
  //   properties: {
  //     name: 'Coors Field',
  //     amenity: 'Baseball Stadium',
  //     popupContent: 'This is where the Rockies play!',
  //   },
  //   geometry: {
  //     type: 'Point',
  //     coordinates: [-122.5, 37.75],
  //   },
  // };
  // layer.addData(geojsonFeature);

  return {
    init: () => layer,
    update: (map: L.Map, data: PanelData) => {
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
          if (!marker) {
            marker = L.marker([0, 0], {
              icon: smallIcon,
            });
            layer.addLayer(marker);
          }
          const idx = lat.values.length - 1;
          const latV = lat.values.get(idx);
          const lngV = lng.values.get(idx);
          if (latV != null && lngV != null) {
            marker.setLatLng([latV, lngV]);
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
  create: (options: MapLayerConfig<DynamicLayerOptions>) => newDynamicLayerHandler(options),
};

export const defaultFrameConfig: MapLayerConfig<DynamicLayerOptions> = {
  type: dynamic.id,
};

export const dynamicLayers = [dynamic];
