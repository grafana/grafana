import { store } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DASHBOARD_FROM_LS_KEY, type DashboardDTO } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';
import { buildGridItemForPanel } from '../serialization/transformSaveModelToScene';

export function addPanelsOnLoadBehavior(scene: DashboardScene) {
  const dto = store.getObject<DashboardDTO>(DASHBOARD_FROM_LS_KEY);

  if (dto) {
    const model = new DashboardModel(dto.dashboard);

    for (const panel of model.panels) {
      const gridItem = buildGridItemForPanel(panel);
      scene.addPanel(gridItem.state.body);
    }

    reportInteraction('explore_to_dashboard_panel_applied', { panelCount: model.panels.length }, { silent: true });

    if (dto.dashboard.time) {
      const newTimeRange = new SceneTimeRange({ from: dto.dashboard.time.from, to: dto.dashboard.time.to });
      const timeRange = scene.state.$timeRange;
      if (timeRange) {
        timeRange.setState({
          value: newTimeRange.state.value,
          from: newTimeRange.state.from,
          to: newTimeRange.state.to,
        });
      }
    }
  }

  store.delete(DASHBOARD_FROM_LS_KEY);
}
