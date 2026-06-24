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
      id: 'sre',
      title: t('home.presets.sre.title', 'SRE'),
      description: t('home.presets.sre.description', 'Alerts, incidents, on-call and dashboards'),
      icon: 'bell',
      widgetIds: ['alerts', 'incidents', 'oncall', 'investigations', 'dashboards'],
    },
    {
      id: 'analytics',
      title: t('home.presets.analytics.title', 'Business analytics'),
      description: t('home.presets.analytics.description', 'Dashboards and quick links'),
      icon: 'chart-line',
      widgetIds: ['dashboards', 'quick-links'],
    },
    {
      id: 'default',
      title: t('home.presets.default.title', 'Default'),
      description: t('home.presets.default.description', 'Dashboards and firing alerts'),
      icon: 'apps',
      widgetIds: ['dashboards', 'alerts'],
    },
  ];
}
