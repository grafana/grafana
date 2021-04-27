import React, { Component } from 'react';

import uPlot from 'uplot';

interface Props {
  // nothing
}

export class CursorView extends Component<Props> {
  render() {
    return <div>{uPlot.sync}</div>;
  }
}
