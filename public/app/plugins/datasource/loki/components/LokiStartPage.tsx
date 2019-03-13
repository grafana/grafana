import React, { PureComponent } from 'react';
import LokiCheatSheet from './LokiCheatSheet';
import { ExploreStartPageProps } from '@grafana/ui';

export default class LokiStartPage extends PureComponent<ExploreStartPageProps> {
  render() {
    return (
      <div className="grafana-info-box grafana-info-box--max-lg">
        <LokiCheatSheet onClickExample={this.props.onClickExample} />
      </div>
    );
  }
}
