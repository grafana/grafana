import React, { PureComponent } from 'react';

import PromCheatSheet from './PromCheatSheet';

export default class PromStart extends PureComponent<any> {
  render() {
    return (
      <div className="grafana-info-box">
        <PromCheatSheet onClickExample={this.props.onClickExample} />} etdiv>
      </div>
    );
  }
}
