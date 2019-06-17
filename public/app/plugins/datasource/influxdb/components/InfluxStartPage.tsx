import React, { PureComponent } from 'react';
import { ExploreStartPageProps } from '@grafana/ui';
import InfluxCheatSheet from './InfluxCheatSheet';

export default class InfluxStartPage extends PureComponent<ExploreStartPageProps> {
  render() {
    return (
      <div className="grafana-info-box grafana-info-box--max-lg">
        <InfluxCheatSheet onClickExample={this.props.onClickExample} />
      </div>
    );
  }
}
