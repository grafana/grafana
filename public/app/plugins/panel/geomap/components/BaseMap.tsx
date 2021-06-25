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
  height: number;
  options: GeomapPanelOptions;
  data: PanelData;
}

import 'ol/ol.css';
import 'ol-layerswitcher/dist/ol-layerswitcher.css';

import { GeomapPanelOptions } from '../types';
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

    if (this.props.height !== oldProps.height) {
      this.map.updateSize();
    }

    // // External configuraiton changed
    // if (this.props.options !== oldProps.options) {
    //   this.optionsChanged(oldProps.options);
    // }

    // External data changed
    if (this.props.data !== oldProps.data) {
      this.dataChanged(oldProps.data);
    }
  }

  // /**
  //  * Called when the panel options change
  //  */
  // optionsChanged(oldOptions: GeomapPanelOptions) {
  //   const { options } = this.props;
  //   const controls = options.controls ?? {};
  //   const oldControls = oldOptions.controls ?? {};
  //   console.log('options changed!', controls, oldControls, controls === oldControls);

  //   // Check controls
  //   if (controls.hideZoom !== oldControls.hideZoom) {
  //     console.log('zoom changed', controls.hideZoom);
  //     if (controls.hideZoom) {
  //       this.map.removeControl(this.map.zoomControl);
  //     } else {
  //       this.map.addControl(this.map.zoomControl);
  //     }
  //   }
  // }

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
    if (!div) {
      if (this.map) {
        this.map.dispose();
      }
      this.map = (undefined as unknown) as GeoMap;
      return;
    }

    // const osm = new TileLayer({
    //   title: 'OSM',
    //   type: 'base',
    //   visible: true,
    //   source: new OSM(),
    // } as any);

    // const watercolor = new TileLayer({
    //   title: 'Water color',
    //   type: 'base',
    //   visible: false,
    //   source: new Stamen({
    //     layer: 'watercolor',
    //   }),
    // } as any);

    // const baseMaps = new LayerGroup({
    //   title: 'Base maps',
    //   layers: [osm, watercolor],
    // } as any);

    // const { options } = this.props;

    this.map = new GeoMap({
      view: new View({
        center: [0, 0],
        zoom: 1,
      }),
      pixelRatio: 1, // or zoom?
      layers: [], // delay...
      controls: [
        new Zoom({}),
        new ScaleLine({
          bar: false,
        }),
        new Attribution({
          collapsible: true,
          collapsed: true,
        }),
        new OverviewMap({
          collapsed: false,
          collapsible: true,
          layers: [
            new TileLayer({
              source: new OSM(),
            }),
          ],
        }),
      ],
      target: div,
    });

    const iiiii: BaseLayer[] = [];
    let basemaps = this.props.options.basemaps;
    if (!basemaps || !basemaps.length) {
      // all basemaps
      basemaps = geomapLayerRegistry
        .list()
        .filter((v) => v.isBaseMap)
        .map((v) => ({ type: v.id }));

      // basemaps = [
      //   { type: 'esri-basemap-streets' },
      //   { type: 'esri-basemap-imagery' },
      //   { type: 'esri-basemap-topo' }, //
      // ];
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
      console.log('HELLO', layer);
      this.map.addLayer(layer);

      this.handlers.set(defaultFrameConfig, handler);
    }

    // if (baseLayerCount > 1) {
    //   L.control.layers(baseMaps, overlayMaps).addTo(this.map);
    // }
  };

  render() {
    return <div style={{ width: '100%', height: this.props.height }} ref={this.initMapRef}></div>;
  }
}
