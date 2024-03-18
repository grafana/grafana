import { PanelModel } from '@grafana/data';
import { QueryBuilderLabelFilter } from '@grafana/prometheus/src/querybuilder/shared/types';
import { SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';

import { QueryMetric } from './getQueryMetrics';

// We only support label filters with the '=' operator
export function isEquals(labelFilter: QueryBuilderLabelFilter) {
  return labelFilter.op === '=';
}

export function getQueryRunner(panel: VizPanel | PanelModel) {
  if (panel instanceof VizPanel) {
    return getQueryRunnerFor(panel);
  }

  return new SceneQueryRunner({ datasource: panel.datasource || undefined, queries: panel.targets || [] });
}

export function getTimeRangeFromDashboard(dashboard: DashboardScene | DashboardModel) {
  if (dashboard instanceof DashboardScene) {
    return dashboard.state.$timeRange!.clone();
  }
  if (dashboard instanceof DashboardModel) {
    return new SceneTimeRange({ ...dashboard.time });
  }
  return new SceneTimeRange();
}

export function getQueryMetricLabel({ metric, labelFilters }: QueryMetric) {
  // Don't show the filter unless there is more than one entry
  if (labelFilters.length === 0) {
    return metric;
  }

  const filter = `{${labelFilters.map(({ label, op, value }) => `${label}${op}"${value}"`)}}`;
  return `${metric}${filter}`;
}

export function createAdHocFilters(labels: QueryBuilderLabelFilter[]) {
  return labels?.map((label) => ({ key: label.label, value: label.value, operator: label.op }));
}
