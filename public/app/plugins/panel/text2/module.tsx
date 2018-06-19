import React from 'react';

export class ReactTestPanel extends React.Component<any, any> {
  constructor(props) {
    super(props);
  }

  render() {
    return <h2>I am a react panel, haha!</h2>;
  }
}

export { ReactTestPanel as PanelComponent };
