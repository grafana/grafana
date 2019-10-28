// Libraries
import React, { PureComponent } from 'react';

import { PanelModel } from 'app/features/dashboard/state/PanelModel';

interface Props {
  panel: PanelModel;
}

export class PanelInspector extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return <div>TODO show inspector</div>;
  }
}
