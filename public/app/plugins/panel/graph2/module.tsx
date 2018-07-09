import React, { PureComponent } from 'react';
import { PanelProps } from 'app/features/dashboard/dashgrid/DataPanel';

export class ReactTestPanel extends PureComponent<PanelProps> {
  constructor(props) {
    super(props);
  }

  render() {
    const { data } = this.props;
    let value = 0;

    if (data.length) {
      value = data[0].value;
    }

    return <h2>Graph Panel! {value}</h2>;
  }
}

export { ReactTestPanel as PanelComponent };
