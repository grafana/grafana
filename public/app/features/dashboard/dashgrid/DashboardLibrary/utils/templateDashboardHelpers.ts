import { type DataSourceInstanceListItem } from '@grafana/data';
import { DASHBOARD_LIBRARY_ROUTES } from 'app/features/dashboard/dashgrid/types';
import { type PluginDashboard } from 'app/types/plugins';

import { CONTENT_KINDS, CREATION_ORIGINS, type SourceEntryPoint } from '../constants';
import { type GnetDashboard } from '../types';

import { isGnetDashboard } from './dashboardLibraryHelpers';

export type AssistantSource = 'assistant_button' | 'assistant_chat';

export function getTemplateDashboardUrl(
  dashboard: PluginDashboard | GnetDashboard,
  testDataSource: DataSourceInstanceListItem | undefined,
  sourceEntryPoint: SourceEntryPoint,
  assistantSource?: AssistantSource
): string {
  const isGnet = isGnetDashboard(dashboard);

  const params = new URLSearchParams({
    datasource: testDataSource?.uid || '',
    title: isGnet ? dashboard.name : dashboard.title,
    pluginId: String(testDataSource?.type) || '',
    gnetId: String(isGnet ? dashboard.id : undefined),
    sourceEntryPoint,
    // tracking event purpose values
    libraryItemId: String(isGnet ? dashboard.id : undefined),
    creationOrigin: CREATION_ORIGINS.DASHBOARD_LIBRARY_TEMPLATE_DASHBOARD,
    contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
  });

  if (assistantSource) {
    params.set('assistantSource', assistantSource);
  }

  return `${DASHBOARD_LIBRARY_ROUTES.Template}?${params.toString()}`;
}
