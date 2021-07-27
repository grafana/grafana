// Libraries
import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions } from './models.gen';

interface Props extends PanelProps<PanelOptions> {}

interface State {
  item: string;
}

export class CanvasPanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { root } = this.props.options;
    if (root?.elements?.length) {
      return <pre>{JSON.stringify(root.elements[0], null, 2)}</pre>;
    }

    return <div>HELLO</div>;
  }
}
