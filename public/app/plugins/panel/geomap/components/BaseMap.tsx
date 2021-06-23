import React, { PureComponent } from 'react';
import { geomapLayerRegistry } from '../layers/registry';
import L from 'leaflet';
import { cloneDeep } from 'lodash';

interface BaseMapProps {
  height: number;
  options: GeomapPanelOptions;
  data: PanelData;
}

// Load the leaflet CSS
import 'leaflet/dist/leaflet.css';
import { GeomapPanelOptions } from '../types';
import { PanelData } from '@grafana/data';

export class BaseMap extends PureComponent<BaseMapProps> {
  map: L.Map;

  constructor(props: BaseMapProps) {
    super(props);
  }

  componentDidUpdate(oldProps: BaseMapProps) {
    if (!this.map) {
      console.log('SKIPPING????');
      return; // not yet initalized
    }

    if (this.props.height !== oldProps.height) {
      this.map.invalidateSize();
    }

    // External configuraiton changed
    if (this.props.options !== oldProps.options) {
      console.log('OOOOOOOOO', cloneDeep(this.props.options), cloneDeep(oldProps.options));
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
    if (controls.hideZoom !== oldControls.hideZoom) {
      console.log('zoom changed', controls.hideZoom);
      if (controls.hideZoom) {
        this.map.removeControl(this.map.zoomControl);
      } else {
        this.map.addControl(this.map.zoomControl);
      }
    }
  }

  /**
   * Called when PanelData changes (query results etc)
   */
  dataChanged(data: PanelData) {
    //  console.log('data changed?', data.structureRev, this.props.data.structureRev);
  }

  initMapRef = (div: HTMLDivElement) => {
    if (!div) {
      if (this.map) {
        this.map.remove();
      }
      this.map = (undefined as unknown) as L.Map;
      return;
    }

    const { options } = this.props;

    this.map = L.map(div, {
      zoomControl: !options.controls?.hideZoom,

      center: [37.75, -122.23],
      zoom: 10,
    });

    const baseMaps: L.Control.LayersObject = {};
    const overlayMaps: L.Control.LayersObject = {};

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

    let baseLayerCount = 0;
    for (const cfg of basemaps) {
      const item = geomapLayerRegistry.getIfExists(cfg.type);
      if (!item) {
        console.warn('missing layer ???', cfg);
        continue;
      }
      const layer = item.create(cfg).init();
      if (baseLayerCount === 0) {
        layer.addTo(this.map);
      }
      baseLayerCount++;
      const name = cfg.name ?? item.name;
      baseMaps[name] = layer;
    }

    if (baseLayerCount > 1) {
      L.control.layers(baseMaps, overlayMaps).addTo(this.map);
    }
  };

  render() {
    return <div style={{ width: '100%', height: this.props.height }} ref={this.initMapRef}></div>;
  }
}
