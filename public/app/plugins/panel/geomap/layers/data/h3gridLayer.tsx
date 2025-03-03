import { cellToBoundary, getRes0Cells, cellToChildren, polygonToCells, gridDisk } from "h3-js";
import { isNumber } from 'lodash';
import { Feature, MapEvent } from 'ol';
import { FeatureLike } from "ol/Feature";
import OlMap from 'ol/Map';
import { Polygon } from 'ol/geom';
import VectorLayer from "ol/layer/Vector";
import { transformExtent } from 'ol/proj';
import { Fill } from "ol/style";
import { ReactNode } from "react";
import { ReplaySubject } from "rxjs";

import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2, EventBus, PanelData, PluginState } from '@grafana/data';
import { locationService } from "@grafana/runtime";
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
import fixAntimeridianSimplePolygon from '../../utils/geometryHelpers';
import { getStyleDimension } from "../../utils/utils";


export interface H3GridConfig {
  idField?: string;
  valueField?: string;
  style: StyleConfig;
  showLegend?: boolean;
  updateVariablesOnMove?: boolean;
}

const defaultOptions: H3GridConfig = {
  style: defaultStyleConfig,
  showLegend: true,
  updateVariablesOnMove: false,
};

export const H3GRID_LAYER_ID = 'h3grid';
const H3_LOOKUP_RESOLUTION = 1;

/**
 * Get H3 cells covering a polygon and expand the coverage by including neighbors.
 * This function can be removed once h3-j2 version 4.2.0 is availlable and polygonToCellsExperimental can be used.
 *
 * @param {Array} polygon - The polygon coordinates in GeoJSON-like format.
 * @param {number} resolution - The desired H3 resolution.
 * @param {number} expansion - Number of neighboring layers to add (default: 1).
 * @returns {Array} - Array of H3 cell indices covering the polygon.
 */
function getExpandedH3CellsForPolygon(polygon: number[][] | number[][][], resolution: number, expansion = 1) {
  // Get initial cells that intersect the polygon
  const h3Cells = new Set(polygonToCells(polygon, resolution, true));

  // Expand coverage by adding neighboring cells
  const expandedCells = new Set(h3Cells);
  for (const cell of h3Cells) {
    gridDisk(cell, expansion).forEach((neighbor) => expandedCells.add(neighbor));
  }

  return Array.from(expandedCells);
}

const zoomToH3Resolution = (zoom: number): number => {
  // Define a mapping from zoom levels to H3 resolutions
  const zoomToH3 = [
    { zoom: 0, res: 0 },
    { zoom: 1, res: 1 },
    { zoom: 2.5, res: 2 },
    { zoom: 3.5, res: 3 },
    { zoom: 4.5, res: 4 },
    { zoom: 5.5, res: 5 },
    { zoom: 7, res: 6 },
  ];

  // Find the highest zoom level that is <= the current zoom
  let res = 6; // Default to max res
  for (const entry of zoomToH3) {
    if (zoom >= entry.zoom) {
      res = entry.res;
    } else {
      break;
    }
  }

  return res;
};

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
    
    map.on('moveend', (event: MapEvent) => {
      
      if (config.updateVariablesOnMove) {
        const zoom = map.getView().getZoom() ?? 0;
        const h3resolution = zoomToH3Resolution(zoom);
        locationService.partial({ 'var-h3Resolution': h3resolution });
          
        const extent = map.getView().calculateExtent(map.getSize())
        
        const extent4326 = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');        
        
        const [minX, minY, maxX, maxY] = extent4326;
        const longitudeWidth = Math.abs(maxX - minX);

        let cellsInView = undefined;
        
        if ( longitudeWidth < 180 ){    // There seem to be an issue with polygonToCells https://github.com/uber/h3-js/issues/191, https://github.com/uber/h3-js/issues/24
          const extentPolygonCoord = [[
            [minX, minY], // Bottom-left corner
            [maxX, minY], // Bottom-right corner
            [maxX, maxY], // Top-right corner
            [minX, maxY], // Top-left corner
            [minX, minY], // Close the polygon
          ]];          
          
          //cellsInView = polygonToCells(extentPolygonCoord, H3_LOOKUP_RESOLUTION, true);          
          cellsInView = getExpandedH3CellsForPolygon(extentPolygonCoord, H3_LOOKUP_RESOLUTION, 2);

        } else {              
           cellsInView = getRes0Cells().flatMap(cell => cellToChildren(cell, H3_LOOKUP_RESOLUTION));;                    
        } 

        locationService.partial({ 'var-h3cellsInView': cellsInView }); 
      }           
    });


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
                const extentPoly4326 = new Polygon([reorderedBoundary]);
                const fixedExtentPoly426 = fixAntimeridianSimplePolygon(extentPoly4326); //very important for low res polygons.
                                              
                const idx = idToIdx.get(h3_index) ?? -1;
                if (idx < 0) {
                  return;
                }
                const h3Feature = new Feature({
                  geometry: fixedExtentPoly426.transform('EPSG:4326', 'EPSG:3857'),
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
            defaultValue: defaultOptions.updateVariablesOnMove,
          })
          .addBooleanSwitch({
            path: 'config.updateVariablesOnMove',
            name: 'Update variables on move',
            description: 'Updates global variables $h3cellsInView and $h3Resolution when the map moves to be used in queries',
            defaultValue: false,
          })
          ;

      },

    };
  },
  defaultOptions,
};

