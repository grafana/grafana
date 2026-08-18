import { type DataSourceInstanceListItem, type IconName } from '@grafana/data';

import { type SolutionSparklineData } from './SolutionSparkline';
import { type SOLUTION_IDS } from './constants';
import { type SignalStatus } from './solutionState';

export type SolutionId = (typeof SOLUTION_IDS)[number];

/**
 * The solution owns CTA copy and destination. Each surface owns presentation and analytics.
 */
export interface SolutionCta {
  label: string;
  href: string;
}

export interface SolutionLearnMore {
  href: string;
  label?: string;
  ariaLabel?: string;
  /** Learn-more destinations are external unless explicitly marked otherwise. */
  external?: boolean;
}

export interface SolutionStats {
  primary: string;
  secondary?: string;
}

interface SolutionAlert {
  primary: string;
  details?: string[];
  /** Omitted when no destination can provide useful context for the alert. */
  cta?: SolutionCta;
}

interface SolutionIdentity {
  id: SolutionId;
  title: string;
  icon: IconName;
}

export interface SolutionOffer {
  availability: 'enable' | 'setup';
  description: string;
  setupHint?: string;
  /** Null keeps the offer visible when this user cannot perform the action. */
  cta: SolutionCta | null;
  learnMore?: SolutionLearnMore;
}

/**
 * A solution exposes lazy facts and owns any work shared between them. Each homepage section
 * requests only what it needs, derives its own presentation, and decides how rejected facts degrade.
 */
export type Solution = SolutionIdentity & {
  signal: () => Promise<SignalStatus>;
  /** The datasource carrying the data; null when the solution has none to render from. */
  datasource: () => Promise<DataSourceInstanceListItem | null>;
  /** Whether the solution belongs in the Overview's attention group. */
  needsAttention: () => Promise<boolean>;
  stats: () => Promise<SolutionStats | null>;
  /** Slower, richer stats for the same card; readers prefer these once they resolve. */
  refinedStats: () => Promise<SolutionStats | null>;
  sparkline: () => Promise<SolutionSparklineData | null>;
  cta: () => Promise<SolutionCta | null>;
  /** What needs attention about this solution, or null when nothing does. */
  alert: () => Promise<SolutionAlert | null>;
  offer: () => Promise<SolutionOffer | null>;
};
