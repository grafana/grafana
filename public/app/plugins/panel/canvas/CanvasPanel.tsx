// Libraries
import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions } from './models.gen';

interface Props extends PanelProps<PanelOptions> {}

interface State {
  html: string;
}

export class CanvasPanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return <div>HELLO</div>;
  }
}
