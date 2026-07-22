import { type GrafanaTheme2, type IconName } from '@grafana/data';

import { type SolutionSparklineData } from './SolutionSparkline';

export interface RecommendationItem {
  id: string; // stable telemetry id (recommendation_id)
  title: string;
  icon: IconName;
  color: string | ((theme: GrafanaTheme2) => string);
  context: string; // short "why you are seeing this" line under the title
  description: string;
  action: string; // CTA label, e.g. "Enable Hosted Traces"
  href: string;
}

export interface ExistingItem {
  title: string;
  icon: IconName;
  subtitle?: string;
  stats?: { primary: string; secondary: string };
  statsLoading?: boolean;
  sparkline?: SolutionSparklineData;
  sparklineLoading?: boolean;
  alert?: {
    primary: string;
    details?: string[];
    action: string;
    href: string;
  };
  action: string;
  href: string;
}
