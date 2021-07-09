import React from 'react';
import { MapLayerRegistryItem, MapLayerConfig, MapLayerHandler, PanelData, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import * as style from 'ol/style';
import {Point} from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import tinycolor from 'tinycolor2';
import { SimpleLegend } from '../../components/SimpleLegend';

export interface WorldmapConfig {
  // anything
}

const defaultOptions: WorldmapConfig = {
  // icon: 'https://openlayers.org/en/latest/examples/data/icon.png',
};

export const worldmapBehaviorLayer: MapLayerRegistryItem<WorldmapConfig> = {
  id: 'worldmap-behavior',
  name: 'Worldmap behavior',
  description: 'behave the same as worldmap plugin',
  isBaseMap: false,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig<WorldmapConfig>, theme: GrafanaTheme2): MapLayerHandler => {
    // const config = { ...defaultOptions, ...options.config };
    const vectorLayer = new layer.Vector({});
    let legendInstance = <SimpleLegend txt={ `initalizing...`}/>;
    let count = 0;
    return {
      init: () => vectorLayer,
      legend: () => {
        return legendInstance;
      },
      update: (data: PanelData) => {
        count++;
        const features:Feature[] = [];
        for( let x=0; x<100; x+=20) {
          for( let y=0; y<40; y+=10) {
            const dot = new Feature({
              geometry: new Point(fromLonLat([x,y])),
            });  
            dot.setStyle(new style.Style({
              image: new style.Circle({
                fill: new style.Fill({
                  color: tinycolor({r:(x*2), g:(y*3), b:0}).toString(),
                }),
                radius: (4 + (y*0.5) + (x*0.1)),
              })
            }));
            features.push(dot);
          }
        }
        legendInstance = <SimpleLegend txt={ `Update: ${count}`} data={data}/>;

        const vectorSource = new source.Vector({ features });
        vectorLayer.setSource(vectorSource);
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
