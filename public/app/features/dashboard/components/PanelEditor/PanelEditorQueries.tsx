import React, { PureComponent } from 'react';
import { QueriesTab } from 'app/features/query/components/QueriesTab';
import { DashboardModel, PanelModel } from '../../state';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class PanelEditorQueries extends PureComponent<Props> {
  render() {
    const { panel, dashboard } = this.props;

    return <QueriesTab panel={panel} dashboard={dashboard} />;
  }
}
