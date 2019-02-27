import React, { PureComponent } from 'react';
import { PanelProps, ReactPanelPlugin } from '@grafana/ui';

export class Text2 extends PureComponent<PanelProps> {
  constructor(props: PanelProps) {
    super(props);
  }

  render() {
    return <h2>Text Panel!</h2>;
  }
}

export const reactPanel = new ReactPanelPlugin(Text2);
