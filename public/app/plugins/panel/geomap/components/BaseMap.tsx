import React, { PureComponent } from 'react';
import L from 'leaflet';
import * as EL from 'esri-leaflet';

interface BaseMapProps {
  width: number;
  height: number;
  options: GeomapPanelOptions;
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

    const streets = EL.basemapLayer('Streets');
    const baseMaps = {
      Streets: streets,
      Imagery: EL.basemapLayer('Imagery'),
    };
    const overlayMaps = {}; // none?

    streets.addTo(this.map);
    L.control.layers(baseMaps, overlayMaps).addTo(this.map);
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
