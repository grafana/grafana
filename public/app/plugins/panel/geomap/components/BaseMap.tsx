import React, { PureComponent } from 'react';
import L from 'leaflet';

interface BaseMapProps {
  width: number;
  height: number;
  options: GeomapPanelOptions;
}

// Load the leaflet CSS
import 'leaflet/dist/leaflet.css';
import { GeomapPanelOptions } from '../types';

export class Map extends PureComponent<BaseMapProps> {
  private divRef = React.createRef<HTMLDivElement>();
  map: L.Map;

  constructor(props: BaseMapProps) {
    super(props);
  }

  componentDidMount() {
    const { options } = this.props;

    this.map = L.map(this.divRef.current!, {
      zoomControl: options.showZoomControl,
      center: [49.8419, 24.0315],
      zoom: 16,
      layers: [
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
        }),
      ],
    });
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
