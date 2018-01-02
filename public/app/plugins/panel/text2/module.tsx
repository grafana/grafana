import React from 'react';

export class ReactTestPanel extends React.Component<any, any> {
  constructor(props) {
    super(props);
  }

  render() {
    return <h2>Panel content</h2>;
  }
}

export { ReactTestPanel as PanelComponent };
