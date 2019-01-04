import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/ui';

export class Text2 extends PureComponent<PanelProps> {
  constructor(props) {
    super(props);
  }

  render() {
    return <h2>Text Panel!</h2>;
  }
}

export { Text2 as Panel };
