import React, { PureComponent } from 'react';
import PromCheatSheet from './PromCheatSheet';

interface Props {
  onClickExample: () => void;
}

export default class PromStart extends PureComponent<Props> {
  render() {
    return (
      <div className="grafana-info-box grafana-info-box--max-lg">
        <PromCheatSheet onClickExample={this.props.onClickExample} />
      </div>
    );
  }
}
