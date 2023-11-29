import { PanelMenuItem } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { buildVisualQueryFromString } from 'app/plugins/datasource/prometheus/querybuilder/parsing';

import { DashboardScene } from '../dashboard-scene/scene/DashboardScene';
import { getQueryRunnerFor } from '../dashboard-scene/utils/utils';

import { DataTrailDrawer } from './DataTrailDrawer';

export function addDataTrailPanelAction(dashboard: DashboardScene, vizPanel: VizPanel, items: PanelMenuItem[]) {
  const queryRunner = getQueryRunnerFor(vizPanel);
  if (!queryRunner) {
    return;
  }

  const ds = getDataSourceSrv().getInstanceSettings(queryRunner.state.datasource);
  if (!ds || ds.meta.id !== 'prometheus' || queryRunner.state.queries.length > 1) {
    return;
  }

  const query = queryRunner.state.queries[0];
  const parsedResult = buildVisualQueryFromString(query.expr);
  if (parsedResult.errors.length > 0) {
    return;
  }

  items.push({
    text: 'Data trail',
    iconClassName: 'code-branch',
    onClick: () => {
      dashboard.showModal(
        new DataTrailDrawer({ query: parsedResult.query, dsRef: ds, timeRange: dashboard.state.$timeRange!.clone() })
      );
    },
    shortcut: 'p s',
  });
}
