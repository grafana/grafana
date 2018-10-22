import React, { PureComponent } from 'react';
import { PanelProps } from 'app/types';

export class Text2 extends PureComponent<PanelProps> {
  constructor(props) {
    super(props);
  }

  render() {
    return <h2>Text Panel!</h2>;
  }
}

export { Text2 as PanelComponent };
