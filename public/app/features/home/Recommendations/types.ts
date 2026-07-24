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
  id: string; // stable telemetry id (solution)
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

/**
 * Result contract for a solution provider hook in the useExistingSolutions registry.
 * Providers fail closed: a probe error reports as `item: null` (rendered as no data),
 * never as a user-visible error.
 */
export interface ExistingSolutionProviderResult {
  loading: boolean;
  item: ExistingItem | null;
}
