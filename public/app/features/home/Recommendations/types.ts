import { type GrafanaTheme2, type IconName } from '@grafana/data';

export interface RecommendationItem {
  id: string; // stable telemetry id (recommendation_id)
  title: string;
  icon: IconName;
  color: string | ((theme: GrafanaTheme2) => string);
  context: string; // short "why you are seeing this" line under the title
  description: string;
  action: string; // CTA label, e.g. "Enable Hosted Traces"
  href: string;
  /** Opens documentation or another external destination in a new tab. */
  external?: boolean;
  /** CTA intent for analytics: enable a disabled app (default) or set up an enabled-but-silent one. */
  cta?: 'enable' | 'setup';
}
