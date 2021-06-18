import React, { PureComponent } from 'react';
import { MapLayerConfig } from '@grafana/data';
import { geomapLayerRegistry } from '../layers/registry';
import L from 'leaflet';

interface BaseMapProps {
  width: number;
  height: number;
  options: GeomapPanelOptions;
  basemaps: MapLayerConfig[];
}

// Load the leaflet CSS
import 'leaflet/dist/leaflet.css';
import { GeomapPanelOptions } from '../types';

export class BaseMap extends PureComponent<BaseMapProps> {
  private divRef = React.createRef<HTMLDivElement>();
  map: L.Map;

  constructor(props: BaseMapProps) {
    super(props);
  }

  componentDidMount() {
    const { options } = this.props;

    this.map = L.map(this.divRef.current!, {
      zoomControl: options.showZoomControl,

      center: [37.75, -122.23],
      zoom: 10,
    });

    const baseMaps: L.Control.LayersObject = {};
    const overlayMaps: L.Control.LayersObject = {};

    let basemaps = this.props.basemaps;
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
  }

  componentDidUpdate(oldProps: BaseMapProps) {
    const { width, height, options } = this.props;
    const { map } = this;
    if (width !== oldProps.width || height !== oldProps.height) {
      map.invalidateSize();
    }

    // Check the options
    const oldOptions = oldProps.options;
    if (options !== oldOptions) {
      // Check controls
      if (options.showZoomControl !== oldOptions.showZoomControl) {
        if (options.showZoomControl) {
          map.addControl(map.zoomControl);
        } else {
          map.removeControl(map.zoomControl);
        }
      }
    }
  }

  render() {
    const { width, height } = this.props;
    return <div style={{ width, height }} ref={this.divRef}></div>;
  }
}
