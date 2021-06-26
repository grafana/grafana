import React, { Component } from 'react';
import { geomapLayerRegistry } from '../layers/registry';
import { Map as GeoMap, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Attribution from 'ol/control/Attribution';
import Zoom from 'ol/control/Zoom';
import ScaleLine from 'ol/control/ScaleLine';
import OverviewMap from 'ol/control/OverviewMap';
import BaseLayer from 'ol/layer/Base';

import { PanelData, MapLayerHandler, MapLayerConfig } from '@grafana/data';

interface BaseMapProps {
  width: number;
  height: number;
  options: GeomapPanelOptions;
  data: PanelData;
}

import 'ol/ol.css';

import { ControlsOptions, GeomapPanelOptions } from '../types';
import { defaultFrameConfig, newDynamicLayerHandler } from '../layers/dynamic';
import { defaultGrafanaThemedMap } from '../layers/basemaps/theme';
import { InfoControl } from './InfoControl';

// TODO:
// https://openlayers.org/en/latest/examples/select-hover-features.html

export class BaseMap extends Component<BaseMapProps> {
  map: GeoMap;
  handlers = new Map<MapLayerConfig, MapLayerHandler>();

  // The basemap
  basemap: BaseLayer;

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
    const controls = options.controls ?? {};
    const oldControls = oldOptions.controls ?? {};
    console.log('options changed!', controls, oldControls, controls === oldControls);

    if (true) {
      this.initControls(controls);
    }

    if (true) {
      this.initBasemap(options.basemap);
    }
  }

  /**
   * Called when PanelData changes (query results etc)
   */
  dataChanged(data: PanelData) {
    console.log('data changed?', data.structureRev, this.props.data.structureRev);
    // Pass all data to each layer
    for (const [key, handler] of this.handlers.entries()) {
      if (handler.update && key) {
        handler.update(this.map, data);
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

    if (true) {
      const handler = newDynamicLayerHandler(this.map, defaultFrameConfig);
      const layer = handler.init();
      this.map.addLayer(layer);

      this.handlers.set(defaultFrameConfig, handler);
    }
  };

  initBasemap(cfg: MapLayerConfig) {
    if (!cfg) {
      cfg = { type: defaultGrafanaThemedMap.id };
    }
    const item = geomapLayerRegistry.getIfExists(cfg.type) ?? defaultGrafanaThemedMap;
    const layer = item.create(this.map, cfg).init();
    if (this.basemap) {
      this.map.removeLayer(this.basemap);
      this.basemap.dispose();
    }
    this.basemap = layer;
    this.map.getLayers().insertAt(0, this.basemap);
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
          bar: options.scaleShowBar,
          minWidth: 100,
        })
      );
    }

    if (options.showAttribution) {
      this.map.addControl(new Attribution({ collapsed: true, collapsible: true }));
    }

    if (options.showOverview) {
      this.map.addControl(
        new OverviewMap({
          collapsed: false,
          collapsible: false,
          layers: [
            new TileLayer({
              source: new OSM(), // TODO, get selected baselayer
            }),
          ],
        })
      );
    }

    this.map.addControl(new InfoControl());
  }

  render() {
    const { width, height } = this.props;
    return <div style={{ width, height }} ref={this.initMapRef}></div>;
  }
}
