import React, { Component } from 'react';
import { geomapLayerRegistry } from '../layers/registry';
import { Map as GeoMap, View } from 'ol';
import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Attribution from 'ol/control/Attribution';
import Zoom from 'ol/control/Zoom';
import ScaleLine from 'ol/control/ScaleLine';
import OverviewMap from 'ol/control/OverviewMap';

import LayerSwitcher from 'ol-layerswitcher';
import BaseLayer from 'ol/layer/Base';

import { PanelData, MapLayerHandler, MapLayerConfig } from '@grafana/data';

interface BaseMapProps {
  width: number;
  height: number;
  options: GeomapPanelOptions;
  data: PanelData;
}

import 'ol/ol.css';
import 'ol-layerswitcher/dist/ol-layerswitcher.css';

import { ControlsOptions, GeomapPanelOptions } from '../types';
import { defaultFrameConfig, newDynamicLayerHandler } from '../layers/dynamic';

export class BaseMap extends Component<BaseMapProps> {
  map: GeoMap;
  handlers = new Map<MapLayerConfig, MapLayerHandler>();

  constructor(props: BaseMapProps) {
    super(props);
  }

  // componentDidMount() {
  //   // create feature layer and vector source
  //   var featuresLayer = new ol.layer.Vector({
  //     source: new ol.source.Vector({
  //       features: [],
  //     }),
  //   });

  //   // create map object with feature layer
  //   var map = new ol.Map({
  //     target: this.refs.mapContainer,
  //     layers: [
  //       //default OSM layer
  //       new ol.layer.Tile({
  //         source: new ol.source.OSM(),
  //       }),
  //       featuresLayer,
  //     ],
  //     view: new ol.View({
  //       center: [-11718716.28195593, 4869217.172379018], //Boulder
  //       zoom: 13,
  //     }),
  //   });

  //   map.on('click', this.handleMapClick.bind(this));

  //   // save map and layer references to local state
  //   this.setState({
  //     map: map,
  //     featuresLayer: featuresLayer,
  //   });
  // }

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

    // Check controls
    if (true) {
      //controls !== oldControls) {
      this.initControls(controls);
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

    const iiiii: BaseLayer[] = [];
    let basemaps = this.props.options.basemaps;
    if (!basemaps || !basemaps.length) {
      // all basemaps
      basemaps = geomapLayerRegistry
        .list()
        .filter((v) => v.isBaseMap)
        .map((v) => ({ type: v.id }));
    }

    for (const cfg of basemaps) {
      const item = geomapLayerRegistry.getIfExists(cfg.type);
      if (!item) {
        console.warn('missing layer ???', cfg);
        continue;
      }
      const layer = item.create(this.map, cfg).init();
      layer.set('title', cfg.name ?? item.name); // for ol-layerswitcher
      if (item.isBaseMap) {
        layer.set('type', 'base'); // for ol-layerswitcher
      }
      iiiii.push(layer);
    }

    const baseMaps = new LayerGroup({
      title: 'Base maps', // required for layer switcher
      layers: iiiii,
    } as any);

    this.map.addLayer(baseMaps);

    const layerSwitcher = new LayerSwitcher({
      tipLabel: 'Légende', // Optional label for button
      startActive: false,
      activationMode: 'click',
      reverse: true, // show them in the order we add
    });
    this.map.addControl(layerSwitcher);

    if (true) {
      const handler = newDynamicLayerHandler(this.map, defaultFrameConfig);
      const layer = handler.init();
      this.map.addLayer(layer);

      this.handlers.set(defaultFrameConfig, handler);
    }
  };

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

    console.log('CONTROLS', options, this.map.getControls());
  }

  render() {
    return <div style={{ width: '100%', height: this.props.height }} ref={this.initMapRef}></div>;
  }
}
