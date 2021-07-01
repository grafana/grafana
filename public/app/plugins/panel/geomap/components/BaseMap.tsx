import React, { Component } from 'react';
import { geomapLayerRegistry } from '../layers/registry';
import { Map as GeoMap, View } from 'ol';
import Attribution from 'ol/control/Attribution';
import Zoom from 'ol/control/Zoom';
import ScaleLine from 'ol/control/ScaleLine';
import BaseLayer from 'ol/layer/Base';

import { PanelData, MapLayerHandler, MapLayerConfig } from '@grafana/data';
import { config } from '@grafana/runtime';

interface BaseMapProps {
  width: number;
  height: number;
  options: GeomapPanelOptions;
  data: PanelData;
}

import 'ol/ol.css';

import { ControlsOptions, GeomapPanelOptions } from '../types';
import { defaultGrafanaThemedMap } from '../layers/basemaps/theme';
import { InfoControl } from './InfoControl';

interface MapLayerState {
  config: MapLayerConfig;
  handler: MapLayerHandler;
  layer: BaseLayer; // used to add|remove
}

export class BaseMap extends Component<BaseMapProps> {
  map: GeoMap;

  basemap: BaseLayer;
  layers: MapLayerState[] = [];

  constructor(props: BaseMapProps) {
    super(props);
  }

  componentDidUpdate(oldProps: BaseMapProps) {
    if (!this.map) {
      console.log('SKIPPING????');
      return; // not yet initalized
    }

    // Check for resize
    if (this.props.height !== oldProps.height || this.props.width !== oldProps.width) {
      this.map.updateSize();
    }

    // External configuraiton changed
    if (this.props.options !== oldProps.options) {
      this.optionsChanged(oldProps.options);
    }

    // External data changed
    if (this.props.data !== oldProps.data) {
      this.dataChanged(oldProps.data);
    }
  }

  /**
   * Called when the panel options change
   */
  optionsChanged(oldOptions: GeomapPanelOptions) {
    const { options } = this.props;
    console.log('options changed!', options);

    // NOTE: the panel options editor currently mutates nested objects
    // this means we can not easily detect changes to layer settings :(
    // for now, lets just re-init everything whenever something changes

    if (true) {
      this.initControls(options.controls ?? { showZoom: true, showAttribution: true });
    }

    if (true) {
      this.initBasemap(options.basemap);
    }

    if (true) {
      this.initLayers(options.layers ?? []);
    }
  }

  /**
   * Called when PanelData changes (query results etc)
   */
  dataChanged(data: PanelData) {
    for (const state of this.layers) {
      if (state.handler.update) {
        state.handler.update(this.map, data);
      }
    }
  }

  initMapRef = (div: HTMLDivElement) => {
    if (this.map) {
      this.map.dispose();
    }

    if (!div) {
      this.map = (undefined as unknown) as GeoMap;
      return;
    }
    this.map = new GeoMap({
      view: new View({
        center: [0, 0],
        zoom: 1,
      }),
      pixelRatio: 1, // or zoom?
      layers: [], // delay...
      controls: [], // empty
      target: div,
    });
    // init the controls
    this.initControls(this.props.options.controls);
    this.initBasemap(this.props.options.basemap);
    this.initLayers(this.props.options.layers);
  };

  initBasemap(cfg: MapLayerConfig) {
    if (!cfg) {
      cfg = { type: defaultGrafanaThemedMap.id };
    }
    const item = geomapLayerRegistry.getIfExists(cfg.type) ?? defaultGrafanaThemedMap;
    const layer = item.create(this.map, cfg, config.theme2).init();
    if (this.basemap) {
      this.map.removeLayer(this.basemap);
      this.basemap.dispose();
    }
    this.basemap = layer;
    this.map.getLayers().insertAt(0, this.basemap);
  }

  initLayers(layers: MapLayerConfig[]) {
    // 1st remove existing layers
    for (const state of this.layers) {
      this.map.removeLayer(state.layer);
      state.layer.dispose();
    }

    if (!layers) {
      layers = [];
    }

    this.layers = [];
    for (const overlay of layers) {
      const item = geomapLayerRegistry.getIfExists(overlay.type);
      if (!item) {
        console.warn('unknown layer type: ', overlay);
        continue; // TODO -- panel warning?
      }

      const handler = item.create(this.map, overlay, config.theme2);
      const layer = handler.init();
      if (handler.update) {
        handler.update(this.map, this.props.data);
      }
      this.map.addLayer(layer);
      this.layers.push({
        config: overlay,
        layer,
        handler,
      });
    }
  }

  initControls(options: ControlsOptions) {
    this.map.getControls().clear();

    if (options.showZoom) {
      this.map.addControl(new Zoom());
    }

    if (options.showScale) {
      this.map.addControl(
        new ScaleLine({
          units: options.scaleUnits,
          minWidth: 100,
        })
      );
    }

    if (options.showAttribution) {
      this.map.addControl(new Attribution({ collapsed: true, collapsible: true }));
    }

    if (options.showDebug) {
      this.map.addControl(new InfoControl());
    }
  }

  render() {
    const { width, height } = this.props;
    return <div style={{ width, height }} ref={this.initMapRef}></div>;
  }
}
