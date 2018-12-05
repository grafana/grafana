import React, { PureComponent } from 'react';
import LokiCheatSheet from './LokiCheatSheet';

interface Props {
  onClickExample: () => void;
}

export default class LokiStartPage extends PureComponent<Props> {
  render() {
    return (
      <div className="grafana-info-box grafana-info-box--max-lg">
        <LokiCheatSheet onClickExample={this.props.onClickExample} />
      </div>
    );
  }
}
