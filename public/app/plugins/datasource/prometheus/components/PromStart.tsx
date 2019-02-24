import React, { PureComponent } from 'react';
import PromCheatSheet from './PromCheatSheet';
import { ExploreStartPageProps } from '@grafana/ui';

export default class PromStart extends PureComponent<ExploreStartPageProps> {
  render() {
    return (
      <div className="grafana-info-box grafana-info-box--max-lg">
        <PromCheatSheet onClickExample={this.props.onClickExample} />
      </div>
    );
  }
}
