import { t } from '@grafana/i18n';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { FiringAlertsCard } from '../../AlertsIncidents/FiringAlertsCard';
import { type CoreWidgetDef } from '../types';

import { DashboardsWidget } from './DashboardsWidget';
import { QuickLinksWidget } from './QuickLinksWidget';

/**
 * Built-in widgets available on every instance. A function (not a module-level const) so t() runs
 * after i18n init — the same reason DashboardTabs builds its tab labels inside the component.
 */
export function getCoreWidgets(): CoreWidgetDef[] {
  return [
    {
      id: 'alerts',
      title: t('home.widgets.alerts.title', 'Firing alerts'),
      description: t('home.widgets.alerts.description', 'Alerts currently firing across your instance'),
      icon: 'bell',
      defaultSize: { w: 12, h: 8 },
      minSize: { w: 8, h: 6 },
      isAvailable: () => contextSrv.hasPermission(AccessControlAction.AlertingInstanceRead),
      Component: FiringAlertsCard,
    },
    {
      id: 'dashboards',
      title: t('home.widgets.dashboards.title', 'Dashboards'),
      description: t('home.widgets.dashboards.description', 'Your recent, most-used and starred dashboards'),
      icon: 'apps',
      defaultSize: { w: 24, h: 10 },
      minSize: { w: 12, h: 8 },
      isAvailable: () => true,
      Component: DashboardsWidget,
    },
    {
      id: 'quick-links',
      title: t('home.widgets.quick-links.title', 'Quick links'),
      description: t('home.widgets.quick-links.description', 'Jump to common areas of Grafana'),
      icon: 'link',
      defaultSize: { w: 12, h: 6 },
      minSize: { w: 6, h: 4 },
      isAvailable: () => true,
      Component: QuickLinksWidget,
    },
  ];
}
