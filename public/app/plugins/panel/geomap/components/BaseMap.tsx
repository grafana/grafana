import React, { Component } from 'react';
import { geomapLayerRegistry } from '../layers/registry';
import { Map as GeoMap, View } from 'ol';
import Attribution from 'ol/control/Attribution';
import Zoom from 'ol/control/Zoom';
import ScaleLine from 'ol/control/ScaleLine';
import BaseLayer from 'ol/layer/Base';
import { defaults as interactionDefaults } from 'ol/interaction';
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom';

import { PanelData, MapLayerHandler, MapLayerConfig } from '@grafana/data';
import { config } from '@grafana/runtime';

interface BaseMapProps {
  width: number;
  height: number;
  options: GeomapPanelOptions;
  data: PanelData;
}

import 'ol/ol.css';

import { ControlsOptions, GeomapPanelOptions, MapViewConfig } from '../types';
import { defaultGrafanaThemedMap } from '../layers/basemaps';
import { InfoControl } from './InfoControl';
import { centerPointRegistry, MapCenterID } from '../view';
import { fromLonLat } from 'ol/proj';
import { Coordinate } from 'ol/coordinate';
import { LegendControl } from './LegendControl';

interface MapLayerState {
  config: MapLayerConfig;
  handler: MapLayerHandler;
  layer: BaseLayer; // used to add|remove
}

// The firs one will be reused
let sharedView: View | undefined = undefined;

export class BaseMap extends Component<BaseMapProps> {
  map: GeoMap;

  basemap: BaseLayer;
  layers: MapLayerState[] = [];
  mouseWheelZoom: MouseWheelZoom;

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
      this.dataChanged(this.props.data);
    }
  }

  /**
   * Called when the panel options change
   */
  optionsChanged(oldOptions: GeomapPanelOptions) {
    const { options } = this.props;
    console.log('options changed!', options);

    if (options.view !== oldOptions.view) {
      console.log('View changed');
      this.map.setView(this.initMapView(options.view));
    }

    if (options.controls !== oldOptions.controls) {
      console.log('Crontrols changed');
      this.initControls(options.controls ?? { showZoom: true, showAttribution: true });
    }

    if (options.basemap !== oldOptions.basemap) {
      console.log('Basemap changed');
      this.initBasemap(options.basemap);
    }

    if (options.layers !== oldOptions.layers) {
      console.log('layers changed');
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
    const { options } = this.props;
    this.map = new GeoMap({
      view: this.initMapView(options.view),
      pixelRatio: 1, // or zoom?
      layers: [], // delay...
      controls: [], // empty
      target: div,
      interactions: interactionDefaults({
        mouseWheelZoom: false, // handled explicilty in controls
      }),
    });
    this.mouseWheelZoom = new MouseWheelZoom();
    this.map.addInteraction(this.mouseWheelZoom);
    this.initControls(options.controls);
    this.initBasemap(options.basemap);
    this.initLayers(options.layers);
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

  initMapView(config: MapViewConfig): View {
    let view = new View({
      center: [0, 0],
      zoom: 1,
    });
    if (config.shared) {
      if (!sharedView) {
        sharedView = view;
      } else {
        view = sharedView;
      }
    }

    const v = centerPointRegistry.getIfExists(config.center.id);
    if (v) {
      let coord: Coordinate | undefined = undefined;
      if (v.specialHandling) {
        if (v.id === MapCenterID.Coordinates) {
          const center = config.center ?? {};
          coord = [center.lon ?? 0, center.lat ?? 0];
        } else {
          console.log('TODO, view requires special handling', v);
        }
      } else {
        coord = [v.lon ?? 0, v.lat ?? 0];
      }
      if (coord) {
        view.setCenter(fromLonLat(coord));
      }
    }

    if (config.maxZoom) {
      view.setMaxZoom(config.maxZoom);
    }
    if (config.minZoom) {
      view.setMaxZoom(config.minZoom);
    }
    if (config.zoom) {
      view.setZoom(config.zoom);
    }
    return view;
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

    this.mouseWheelZoom.setActive(Boolean(options.mouseWheelZoom));

    if (options.showAttribution) {
      this.map.addControl(new Attribution({ collapsed: true, collapsible: true }));
    }

    if (options.showDebug) {
      this.map.addControl(new InfoControl());
    }

    if (options.showLegend) {
      this.map.addControl(new LegendControl());
    }
  }

  render() {
    const { width, height } = this.props;
    return <div style={{ width, height }} ref={this.initMapRef}></div>;
  }
}
