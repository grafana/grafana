import React, { Component } from 'react';
import { PanelProps } from '@grafana/data';

import { DebugPanelOptions } from './types';

type Props = PanelProps<DebugPanelOptions>;

export class CursorView extends Component<Props> {
  render() {
    return <div>TODO... show cursoer</div>;
  }
}
