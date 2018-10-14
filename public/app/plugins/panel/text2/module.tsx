import React, { PureComponent } from 'react';
import { PanelProps } from 'app/types';

export class Text2 extends PureComponent<PanelProps> {
  constructor(props) {
    super(props);
  }

  render() {
    const { data } = this.props;
    let value = 0;

    if (data.length) {
      value = data[0].value;
    }

    return <h2>Text Panel! {value}</h2>;
  }
}

export { Text2 as PanelComponent };
