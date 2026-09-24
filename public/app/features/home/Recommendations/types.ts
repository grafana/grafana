import { type IconName } from '@grafana/data';

export interface RecommendationItem {
  id: string; // stable telemetry id (recommendation_id)
  title: string;
  icon: IconName;
  /** Palette name for `theme.visualization.getColorByName`, resolved where rendered so theme switches apply. */
  color: string;
  context: string; // short "why you are seeing this" line under the title
  description: string;
  action: string; // CTA label, e.g. "Enable Hosted Traces"
  href: string;
  /** CTA intent for analytics; defaults to enabling a disabled app. */
  cta?: 'enable' | 'setup' | 'learn_more';
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}
