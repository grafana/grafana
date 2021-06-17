import React, { Component } from 'react';
import { PanelProps } from '@grafana/data';

import { GeomapPanelOptions } from './types';
import { Map } from './components/Map';

type Props = PanelProps<GeomapPanelOptions>;

export class GeomapPanel extends Component<Props> {
  render() {
    const { width, height, options } = this.props;
    return <Map width={width} height={height} options={options} />;
  }
}
