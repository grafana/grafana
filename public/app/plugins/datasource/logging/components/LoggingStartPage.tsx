import React, { PureComponent } from 'react';
import LoggingCheatSheet from './LoggingCheatSheet';

interface Props {
  onClickExample: () => void;
}

export default class LoggingStartPage extends PureComponent<Props> {
  render() {
    return (
      <div className="grafana-info-box">
        <LoggingCheatSheet onClickExample={this.props.onClickExample} />
      </div>
    );
  }
}
