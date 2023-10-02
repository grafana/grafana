import { reportInteraction } from '@grafana/runtime';

export enum EventSource {
  panelDescription = 'panel-description',
  panelTitle = 'panel-title',
  dashboardChanges = 'dashboard-changes',
  dashboardTitle = 'dashboard-title',
  dashboardDescription = 'dashboard-description',
}

export function reportGenerateAIButtonClicked(src: EventSource) {
  reportInteraction('dashboards_autogenerate_clicked', { src });
}
