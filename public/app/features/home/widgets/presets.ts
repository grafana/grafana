import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';

/** A persona/template that seeds a brand-new user's grid with a curated set of widget ids. */
export interface HomePreset {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  /** Catalog ids to seed; unavailable ones are filtered by applyPreset against the live catalog. */
  widgetIds: string[];
}

/** Built as a function so t() runs after i18n init (a top-level const would capture pre-init strings). */
export function getHomePresets(): HomePreset[] {
  return [
    {
      id: 'incident-response',
      title: t('home.presets.incident-response.title', 'Incident response'),
      description: t('home.presets.incident-response.description', 'Active incidents, on-call shifts, SLOs and alerts'),
      icon: 'bell',
      widgetIds: ['alerts', 'incidents', 'oncall', 'slos', 'dashboards'],
    },
    {
      id: 'infrastructure-monitoring',
      title: t('home.presets.infrastructure-monitoring.title', 'Infrastructure monitoring'),
      description: t(
        'home.presets.infrastructure-monitoring.description',
        'Kubernetes, hosted metrics, logs, alerts and dashboards'
      ),
      icon: 'kubernetes',
      widgetIds: ['kubernetes', 'hosted-metrics', 'hosted-logs', 'alerts', 'dashboards'],
    },
    {
      id: 'service-reliability',
      title: t('home.presets.service-reliability.title', 'Service reliability'),
      description: t('home.presets.service-reliability.description', 'SLOs, alerts, telemetry and dashboards'),
      icon: 'heart-rate',
      widgetIds: ['slos', 'alerts', 'hosted-metrics', 'hosted-logs', 'dashboards'],
    },
    {
      id: 'dashboards',
      title: t('home.presets.dashboards.title', 'Dashboards'),
      description: t('home.presets.dashboards.description', 'Your recent, most-used and starred dashboards'),
      icon: 'apps',
      widgetIds: ['dashboards'],
    },
  ];
}
