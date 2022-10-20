import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
  EventBus,
  PluginState,
  FieldType,
} from '@grafana/data';
import Map from 'ol/Map';
import { FeatureLike } from 'ol/Feature';
import { getLocationMatchers } from 'app/features/geo/utils/location';
import VectorLayer from 'ol/layer/Vector';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { Stroke, Style } from 'ol/style';
import Photo from 'ol-ext/style/Photo';

// Configuration options for Circle overlays
export interface PhotoConfig {
  kind: 'square' | 'circle' | 'anchored' | 'folio';
  border?: number; //
  shadow?: boolean;
  crop?: boolean;
}

const defaultOptions: PhotoConfig = {
  kind: 'square',
  border: 2,
  shadow: true,
  crop: true,
};

export const PHOTOS_LAYER_ID = 'photos';

// Used by default when nothing is configured
export const defaultPhotosConfig: MapLayerOptions<PhotoConfig> = {
  type: PHOTOS_LAYER_ID,
  name: '', // will get replaced
  config: defaultOptions,
  location: {
    mode: FrameGeometrySourceMode.Auto,
  },
  tooltip: true,
};

// TODO, should be a question mark or missing or something?
const unknownImage = 'http://www2.culture.gouv.fr/Wave/image/memoire/1597/sap40_d0000861_v.jpg';

/**
 * Map layer configuration for circle overlay
 */
export const photosLayer: MapLayerRegistryItem<PhotoConfig> = {
  id: PHOTOS_LAYER_ID,
  name: 'Photos',
  description: 'Render photos at each data point',
  isBaseMap: false,
  showLocation: true,
  hideOpacity: true,
  state: PluginState.alpha,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: Map, options: MapLayerOptions<PhotoConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const location = await getLocationMatchers(options.location);
    const source = new FrameVectorSource(location);
    const vectorLayer = new VectorLayer({
      source,
    });

    let images: string[] = [];

    vectorLayer.setStyle((feature: FeatureLike) => {
      let src = unknownImage;
      if (images.length > 0) {
        const idx = feature.get('rowIndex') as number;
        src = images[idx] ?? unknownImage;
      }

      return new Style({
        image: new Photo({
          src,
          radius: 20,
          crop: config.crop,
          kind: config.kind,
          shadow: config.shadow,
          stroke: new Stroke({
            width: config.border ?? 0,
            color: '#000' // ????
          })
        })
      });
    });

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          source.clear();
          return; // ignore empty
        }

        for (const frame of data.series) {
          source.update(frame);

          // TODO... pick from config? first string?
          for (let i = 0; i < frame.fields.length; i++) {
            const field = frame.fields[i];
            if (field.type === FieldType.string) {
              images = field.values.toArray();
              break;
            }
          }
          break; // Only the first frame for now!
        }

      },

      // Marker overlay options
      registerOptionsUI: (builder) => {
        builder
          .addRadio({
            path: 'config.kind',
            name: 'Kind',
            settings: {
              options: [
                { label: 'Square', value: 'square' },
                { label: 'Circle', value: 'circle' },
                { label: 'Anchored', value: 'anchored' },
                { label: 'Folio', value: 'folio' }
              ]
            },
            defaultValue: defaultOptions.kind,
          })
          .addBooleanSwitch({
            path: 'config.crop',
            name: 'Crop',
            settings: {},
            defaultValue: defaultOptions.crop,
          })
          .addBooleanSwitch({
            path: 'config.shadow',
            name: 'Shadow',
            settings: {},
            defaultValue: defaultOptions.shadow,
          })
          .addSliderInput({
            path: 'config.border',
            name: 'Border',
            settings: {
              min: 0,
              max: 10,
            },
            defaultValue: defaultOptions.border,
          })
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
