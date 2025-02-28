import { cellToBoundary } from "h3-js";
import { isNumber } from 'lodash';
import { Feature } from 'ol';
import { FeatureLike } from "ol/Feature";
import OlMap from 'ol/Map';
import { Polygon } from 'ol/geom';
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from 'ol/proj';
import { Fill } from "ol/style";
import { ReactNode } from "react";
import { ReplaySubject } from "rxjs";

import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2, EventBus, PanelData, PluginState } from '@grafana/data';
import { findField } from 'app/features/dimensions';
import { FrameVectorSource } from "app/features/geo/utils/frameVectorSource";
import { getLocationMatchers } from "app/features/geo/utils/location";

import { MarkersLegend, MarkersLegendProps } from "../../components/MarkersLegend";
import { ObservablePropsWrapper } from "../../components/ObservablePropsWrapper";
import { StyleEditor } from "../../editor/StyleEditor";
import { polyStyle } from "../../style/markers";
import {
  defaultStyleConfig,
  StyleConfig,
} from '../../style/types';
import { getStyleConfigState } from "../../style/utils";
import { getStyleDimension } from "../../utils/utils";

export interface H3GridConfig {
  idField?: string;
  valueField?: string;
  style: StyleConfig;
  showLegend?: boolean;
}

const defaultOptions: H3GridConfig = {
  style: defaultStyleConfig,
  showLegend: true,
};

export const H3GRID_LAYER_ID = 'h3grid';

export const defaultH3GridConfig: MapLayerOptions<H3GridConfig> = {
  type: H3GRID_LAYER_ID,
  name: '', // will get replaced
  config: defaultOptions,
  tooltip: true,
};

export const h3gridLayer: MapLayerRegistryItem<H3GridConfig> = {
  id: H3GRID_LAYER_ID,
  name: 'H3 Grid',
  description: 'Display data in an h3 layer grid',
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
  create: async (map: OlMap, options: MapLayerOptions<H3GridConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getStyleConfigState(config.style);
    const location = await getLocationMatchers(options.location);

    const source = new FrameVectorSource(location);
    const vectorLayer = new VectorLayer({
      source: source,
    });
    const idToIdx = new Map<string, number>();

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
        const idx: number = idToIdx.get(feature.get('id')) ?? -1;
        if (idx < 0) {
          return style.maker(style.base);
        };
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

        const renderedStyle = polyStyle(values);

        if (renderedStyle.getText()) {
          renderedStyle.getText().setFill(new Fill({ color: 'rgba(0,0,0,1)' }));
        }
        return renderedStyle;
      });
    }

    return {
      init: () => vectorLayer,
      legend: legend,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          source.clear();
          return; // ignore empty
        }

        for (const frame of data.series) {
          style.dims = getStyleDimension(frame, style, theme);

          // Post updates to the legend component
          if (legend) {
            legendProps.next({
              styleConfig: style,
              size: style.dims?.size,
              layerName: options.name,
              layer: vectorLayer,
            });
          }
          //source.update(frame);

          if (frame) {
            const indexField = findField(frame, config.idField);
            const valueField = findField(frame, config.valueField);

            if (indexField) {
              idToIdx.clear();
              indexField.values.forEach((v, i) => idToIdx.set(v, i));
            }

            if (indexField && valueField) {
              source.clear();

              indexField.values.forEach((h3_index) => {
                const boundary = cellToBoundary(h3_index);
                const reorderedBoundary = boundary.map(([lat, lon]) => [lon, lat]);

                //FIXME: Polygons crossing the antimeridian are not correctly rendered (its not a trivial solution)
                // Proj4 and transform have been also tested without luck.
                const transformedBoundary = reorderedBoundary.map(coord => fromLonLat(coord));

                const polygonGeometry = new Polygon([transformedBoundary]);
                const idx = idToIdx.get(h3_index) ?? -1;
                if (idx < 0) {
                  return;
                }
                const h3Feature = new Feature({
                  geometry: polygonGeometry,
                  id: h3_index,
                  value: valueField.values[idx],
                });
                source.addFeature(h3Feature);
              })
            }
            break; // Only the first frame for now!
          }

          vectorLayer.changed();

        }
      },
      registerOptionsUI: (builder) => {

        builder
          .addFieldNamePicker({
            path: 'config.idField',
            name: 'H3 cell ID field',
          })
          .addFieldNamePicker({
            path: 'config.valueField',
            name: 'Value field',
          })
          ///TODO: remove size and symbol properties
          .addCustomEditor({
            id: 'config.style',
            path: 'config.style',
            name: 'Styles',
            editor: StyleEditor,
            settings: {
              displayRotation: false,
              hideSymbol: true,
              hideSize: true,
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
  defaultOptions,
};
