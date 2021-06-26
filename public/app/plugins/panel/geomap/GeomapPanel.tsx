import React, { Component } from 'react';
import { PanelProps } from '@grafana/data';

import { GeomapPanelOptions } from './types';
import { BaseMap } from './components/BaseMap';

type Props = PanelProps<GeomapPanelOptions>;

export class GeomapPanel extends Component<Props> {
  render() {
    const { width, height, options, data } = this.props;
    return <BaseMap height={height} width={width} options={options} data={data} />;
  }
}
