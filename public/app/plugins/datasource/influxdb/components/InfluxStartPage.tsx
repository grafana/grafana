import React, { PureComponent } from 'react';
import { ExploreStartPageProps } from '@grafana/ui';
import InfluxCheatSheet from './InfluxCheatSheet';

export default class InfluxStartPage extends PureComponent<ExploreStartPageProps> {
  render() {
    return <InfluxCheatSheet onClickExample={this.props.onClickExample} />;
  }
}
