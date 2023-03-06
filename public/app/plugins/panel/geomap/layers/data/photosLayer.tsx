import {
  MapLayerRegistryItem,
  PanelData,
  GrafanaTheme2,
  EventBus,
  PluginState,
  FieldType,
  Field,
} from '@grafana/data';
import { FrameGeometrySourceMode, MapLayerOptions } from '@grafana/schema';
import Map from 'ol/Map';
import { FeatureLike } from 'ol/Feature';
import { getLocationMatchers } from 'app/features/geo/utils/location';
import VectorLayer from 'ol/layer/Vector';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { Stroke, Style } from 'ol/style';
import Photo from 'ol-ext/style/Photo';
import { findField } from 'app/features/dimensions';

// Configuration options for Circle overlays
export interface PhotoConfig {
  kind: 'square' | 'circle' | 'anchored' | 'folio';
  border: number; // Sets border width around images
  shadow: boolean; // Renders drop shadow behind images
  crop: boolean; // Crops images to fill shape
  src?: string; // Image source field
  radius: number; // Image radius
  color: string; // Border color
}

const defaultOptions: PhotoConfig = {
  kind: 'square',
  border: 2,
  shadow: true,
  crop: true,
  radius: 20,
  color: 'rgb(200, 200, 200)',
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

// TODO Find a way to use SVG scaled to behave like a png, currently using base64 conversion
//const unknownImageSVG = '../../../../../public/img/icons/unicons/question-circle.svg';
const unknownImage =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBjbGFzcz0iY3NzLWV5eDRkbyI+PHBhdGggZD0iTTExLjI5LDE1LjI5YTEuNTgsMS41OCwwLDAsMC0uMTIuMTUuNzYuNzYsMCwwLDAtLjA5LjE4LjY0LjY0LDAsMCwwLS4wNi4xOCwxLjM2LDEuMzYsMCwwLDAsMCwuMi44NC44NCwwLDAsMCwuMDguMzguOS45LDAsMCwwLC41NC41NC45NC45NCwwLDAsMCwuNzYsMCwuOS45LDAsMCwwLC41NC0uNTRBMSwxLDAsMCwwLDEzLDE2YTEsMSwwLDAsMC0uMjktLjcxQTEsMSwwLDAsMCwxMS4yOSwxNS4yOVpNMTIsMkExMCwxMCwwLDEsMCwyMiwxMiwxMCwxMCwwLDAsMCwxMiwyWm0wLDE4YTgsOCwwLDEsMSw4LThBOCw4LDAsMCwxLDEyLDIwWk0xMiw3QTMsMywwLDAsMCw5LjQsOC41YTEsMSwwLDEsMCwxLjczLDFBMSwxLDAsMCwxLDEyLDlhMSwxLDAsMCwxLDAsMiwxLDEsMCwwLDAtMSwxdjFhMSwxLDAsMCwwLDIsMHYtLjE4QTMsMywwLDAsMCwxMiw3WiI+PC9wYXRoPjwvc3ZnPgo=';
const blankPixel =
  'data:image/svg+xml;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let photoLoad: number[] = []; // TODO find a better way to manage this, used to track image load

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
      let idx: number = Infinity;
      if (images.length > 0) {
        idx = feature.get('rowIndex') as number;
        src = images[idx] ?? unknownImage;
      }
      const photoStyle = new Style({
        image: new Photo({
          src,
          radius: config.radius,
          crop: config.crop,
          kind: config.kind,
          shadow: false,
          stroke: new Stroke({
            width: 0,
            color: 'rgba(0,0,0,0)',
          }),
          onload: () => {
            vectorLayer.changed(); // ensure vector layer is rendered properly after image load
            if (photoLoad && !photoLoad.includes(idx)) {
              photoLoad.push(idx);
            }
          },
        }),
      });
      const blankStyle = new Style({
        image: new Photo({
          src: blankPixel,
          radius: config.radius,
          crop: false,
          kind: config.kind,
          shadow: config.shadow,
          stroke: new Stroke({
            width: config.border ?? 0,
            color: theme.visualization.getColorByName(config.color),
          }),
          onload: () => {
            vectorLayer.changed(); // ensure vector layer is rendered properly after image load
          },
        }),
      });
      const errorStyle = new Style({
        image: new Photo({
          src: unknownImage,
          radius: config.radius,
          crop: false,
          kind: config.kind,
          shadow: false,
          stroke: new Stroke({
            width: 0,
            color: 'rgba(0,0,0,0)',
          }),
          onload: () => {
            vectorLayer.changed(); // ensure vector layer is rendered properly after image load
          },
        }),
      });
      if (photoLoad && photoLoad.includes(idx)) {
        return [blankStyle, photoStyle];
      }
      // If image index is not in the loaded array, return layer stack with error
      return [blankStyle, errorStyle, photoStyle];
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

          // Pick field from config, otherwise use first string field
          if (config.src) {
            const srcField: Field | undefined = findField(frame, config.src);
            if (srcField) {
              images = srcField?.values.toArray();
            }
          } else {
            for (let i = 0; i < frame.fields.length; i++) {
              const field = frame.fields[i];
              if (field.type === FieldType.string) {
                images = field.values.toArray();
                break;
              }
            }
          }
          break; // Only the first frame for now!
        }
      },

      // Marker overlay options
      registerOptionsUI: (builder) => {
        builder
          .addFieldNamePicker({
            path: `config.src`,
            name: 'Image Source field',
            settings: {
              filter: (f: Field) => f.type === FieldType.string,
              noFieldsMessage: 'No string fields found',
            },
          })
          .addRadio({
            path: 'config.kind',
            name: 'Kind',
            settings: {
              options: [
                { label: 'Square', value: 'square' },
                { label: 'Circle', value: 'circle' },
                { label: 'Anchored', value: 'anchored' },
                { label: 'Folio', value: 'folio' },
              ],
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
          .addColorPicker({
            path: 'config.color',
            name: 'Border color',
            defaultValue: defaultOptions.color,
            settings: [{ enableNamedColors: false }],
          })
          .addSliderInput({
            path: 'config.radius',
            name: 'Radius',
            settings: {
              min: 1,
              max: 100,
            },
            defaultValue: defaultOptions.radius,
          });
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
