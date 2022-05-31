import React, { ReactNode } from 'react';
import {
  DataFrame,
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
} from '@grafana/data';
import Map from 'ol/Map';
import { FeatureLike } from 'ol/Feature';
import { getLocationMatchers } from 'app/features/geo/utils/location';
import { getScaledDimension, getColorDimension, getTextDimension, getScalarDimension } from 'app/features/dimensions';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { MarkersLegend, MarkersLegendProps } from './MarkersLegend';
import { ReplaySubject } from 'rxjs';
import { defaultStyleConfig, StyleConfig, StyleDimensions } from '../../style/types';
import { StyleEditor } from './StyleEditor';
import { getStyleConfigState } from '../../style/utils';
import VectorLayer from 'ol/layer/Vector';
import { isNumber } from 'lodash';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';

// Configuration options for Circle overlays
export interface MarkersConfig {
  style: StyleConfig;
  showLegend?: boolean;
}

const defaultOptions: MarkersConfig = {
  style: defaultStyleConfig,
  showLegend: true,
};

export const MARKERS_LAYER_ID = 'markers';

// Used by default when nothing is configured
export const defaultMarkersConfig: MapLayerOptions<MarkersConfig> = {
  type: MARKERS_LAYER_ID,
  name: '', // will get replaced
  config: defaultOptions,
  location: {
    mode: FrameGeometrySourceMode.Auto,
  },
  dataquery: undefined,
  tooltip: true,
};

const getUpdatedFrame = (newData: PanelData, previousData: PanelData, options: MapLayerOptions<MarkersConfig>): DataFrame | undefined => {
  // Check if the value we had selected is missing from the updated list
  let updatedVal = newData.series.find((val) => {
    return val.refId === options.dataquery;
  });
  if (!updatedVal) {
    // Previously selected value is missing from the new list.
    // Find the value that is in the new list but isn't in the old list
    let changedTo = newData.series.find((val) => {
      return !previousData.series.some((val2) => {
        return val2.refId === val.refId;
      });
    });
    if (changedTo) {
      // Found the new value, we assume the old value changed to this one, so we'll use it
      return changedTo;
    } else {
      // The old value was just deleted, fallback to the first available option
      return;
      // Could possibly fallback to another data source, but that might just confuse people
      // return newData.series?.length ? newData.series[0] : undefined;
    }
  }
  return;
};

/**
 * Map layer configuration for circle overlay
 */
export const markersLayer: MapLayerRegistryItem<MarkersConfig> = {
  id: MARKERS_LAYER_ID,
  name: 'Markers',
  description: 'Use markers to render each data point',
  isBaseMap: false,
  showLocation: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: Map, options: MapLayerOptions<MarkersConfig>, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getStyleConfigState(config.style);
    const location = await getLocationMatchers(options.location);
    const source = new FrameVectorSource(location);
    const vectorLayer = new VectorLayer({
      source,
    });

    const legendProps = new ReplaySubject<MarkersLegendProps>(1);
    let legend: ReactNode = null;
    if (config.showLegend) {
      legend = <ObservablePropsWrapper watch={legendProps} initialSubProps={{}} child={MarkersLegend} />;
    }

    if (!style.fields) {
      // Set a global style
      vectorLayer.setStyle(style.maker(style.base));
    } else {
      vectorLayer.setStyle((feature: FeatureLike) => {
        const idx = feature.get('rowIndex') as number;
        const dims = style.dims;
        if (!dims || !isNumber(idx)) {
          return style.maker(style.base);
        }

        const values = { ...style.base };

        if (dims.color) {
          values.color = dims.color.get(idx);
        }
        if (dims.size) {
          values.size = dims.size.get(idx);
        }
        if (dims.text) {
          values.text = dims.text.get(idx);
        }
        if (dims.rotation) {
          values.rotation = dims.rotation.get(idx);
        }
        return style.maker(values);
      });
    }

    return {
      init: () => vectorLayer,
      legend: legend,
      update: (newData: PanelData, previousData?: PanelData, updateDataquery?: (newDataquery: string) => void) => {
        if (!newData.series?.length) {
          source.clear();
          return; // ignore empty
        }
        let frame = newData.series.find(frame => {
          return options.dataquery === frame.refId;
        });
        if (!frame) {
          if (previousData) {
            // it's possible that the series name changed, try to find it and recover
            frame = getUpdatedFrame(newData, previousData, options);
          }
          if (!frame) {
            source.clear();
            return;
          }
          // New data frame was found, need to force a reload of this layer
          updateDataquery && frame.refId && updateDataquery(frame.refId);
        }
        if (style.fields) {
          const dims: StyleDimensions = {};
          if (style.fields.color) {
            dims.color = getColorDimension(frame, style.config.color ?? defaultStyleConfig.color, theme);
          }
          if (style.fields.size) {
            dims.size = getScaledDimension(frame, style.config.size ?? defaultStyleConfig.size);
          }
          if (style.fields.text) {
            dims.text = getTextDimension(frame, style.config.text!);
          }
          if (style.fields.rotation) {
            dims.rotation = getScalarDimension(frame, style.config.rotation ?? defaultStyleConfig.rotation);
          }
          style.dims = dims;
        }

        // Post updates to the legend component
        if (legend) {
          legendProps.next({
            styleConfig: style,
            size: style.dims?.size,
            layerName: options.name,
            layer: vectorLayer,
          });
        }

        source.update(frame);
      },

      // Marker overlay options
      registerOptionsUI: (builder) => {
        builder
          .addCustomEditor({
            id: 'config.style',
            path: 'config.style',
            name: 'Styles',
            editor: StyleEditor,
            settings: {
              displayRotation: true,
            },
            defaultValue: defaultOptions.style,
          })
          .addBooleanSwitch({
            path: 'config.showLegend',
            name: 'Show legend',
            description: 'Show map legend',
            defaultValue: defaultOptions.showLegend,
          });
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
