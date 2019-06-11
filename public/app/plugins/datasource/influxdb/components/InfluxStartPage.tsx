import React, { PureComponent } from 'react';
import { ExploreStartPageProps } from '@grafana/ui';
import InfluxCheatSheet from './InfluxCheatSheet';
import { ExploreMode } from 'app/types';

export default class InfluxStartPage extends PureComponent<ExploreStartPageProps> {
  render() {
    if (this.props.mode === ExploreMode.Logs) {
      return (
        <div className="grafana-info-box grafana-info-box--max-lg">
          <InfluxCheatSheet onClickExample={this.props.onClickExample} />
        </div>
      );
    } else {
      return null;
    }
  }
}
