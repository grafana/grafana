import { type FeatureLike } from 'ol/Feature';
import { type Geometry } from 'ol/geom';
import VectorImage from 'ol/layer/VectorImage';

import { FrameGeometrySourceMode, type MapLayerRegistryItem, type PanelData, PluginState } from '@grafana/data';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getLocationMatchers } from 'app/features/geo/utils/location';

import { StyleEditor } from '../../editor/StyleEditor';
import { polyStyle, routeStyle } from '../../style/markers';
import { defaultStyleConfig, type StyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { getStyleDimension } from '../../utils/utils';

// Configuration options for the Geometry layer
export interface GeometryLayerConfig {
  style: StyleConfig;
}

const defaultOptions: GeometryLayerConfig = {
  style: defaultStyleConfig,
};

export const GEOMETRY_LAYER_ID = 'geometry';

/**
 * Map layer configuration for rendering LineString/Polygon (and other) geometry
 * parsed from a WKT, WKB, or GeoJSON text field
 */
export const geometryLayer: MapLayerRegistryItem<GeometryLayerConfig> = {
  id: GEOMETRY_LAYER_ID,
  name: 'Geometry',
  description: 'Render geometry parsed from a WKT, WKB, or GeoJSON field',
  isBaseMap: false,
  showLocation: true,
  locationModes: [FrameGeometrySourceMode.Wkt, FrameGeometrySourceMode.Wkb, FrameGeometrySourceMode.GeoJson],
  state: PluginState.alpha,

  create: async (map, options, eventBus, theme) => {
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getStyleConfigState(config.style);
    const location = await getLocationMatchers(options.location);
    const source = new FrameVectorSource<Geometry>(location);
    const vectorLayer = new VectorImage({ source });

    vectorLayer.setStyle((feature: FeatureLike) => {
      const idx: number = feature.get('rowIndex');
      const dims = style.dims;
      const values = { ...style.base };
      if (dims?.color) {
        values.color = dims.color.get(idx);
      }
      if (dims?.size) {
        values.size = dims.size.get(idx);
      }
      if (dims?.text) {
        values.text = dims.text.get(idx);
      }
      if (dims?.rotation) {
        values.rotation = dims.rotation.get(idx);
      }

      switch (feature.getGeometry()?.getType()) {
        case 'Polygon':
        case 'MultiPolygon':
          // Size doubles as line/stroke width for non-point geometry, mirroring routeLayer.
          return polyStyle({ ...values, lineWidth: values.size });
        case 'LineString':
        case 'MultiLineString':
          return routeStyle({ ...values, lineWidth: values.size });
        default:
          return style.maker(values);
      }
    });

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          source.clear();
          return; // ignore empty
        }

        for (const frame of data.series) {
          style.dims = getStyleDimension(frame, style, theme);
          source.update(frame);
          break; // Only the first frame for now!
        }
      },

      registerOptionsUI: (builder) => {
        builder.addCustomEditor({
          id: 'config.style',
          path: 'config.style',
          name: 'Style',
          editor: StyleEditor,
          settings: {
            simpleFixedValues: false,
          },
          defaultValue: defaultOptions.style,
        });
      },
    };
  },

  defaultOptions,
};
