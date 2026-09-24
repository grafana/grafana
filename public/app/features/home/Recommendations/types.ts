import { type IconName, type ThemeVizHue } from '@grafana/data';

/** Named shade of a theme visualization hue, e.g. `green` or `dark-green`. */
export type VizColorName = ThemeVizHue['shades'][number]['name'];

export interface RecommendationItem {
  id: string; // stable telemetry id (recommendation_id)
  title: string;
  icon: IconName;
  /** Resolved with `theme.visualization.getColorByName` where rendered so theme switches apply. */
  color: VizColorName;
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
