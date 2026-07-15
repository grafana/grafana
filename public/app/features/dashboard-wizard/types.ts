/** Types shared by the "Generate dashboard" wizard steps. */

export interface WizardDatasource {
  uid: string;
  type: string;
  name?: string;
}

/** A selectable card in the wizard (currently only "Just show me what Grafana can do"). */
export interface WizardOption {
  id: string;
  title: string;
  description?: string;
  icon?: string;
}

/**
 * A recorded `list_label_values` result from the wizard's preparation steps.
 * Accumulated findings are passed into the generation prompt so the building
 * agent starts with the data already verified to exist.
 */
export interface WizardFinding {
  datasourceUid: string;
  datasourceName: string;
  datasourceType: string;
  label: string;
  contains?: string;
  values: string[];
  truncated: boolean;
}

export interface WizardQuestion {
  id: string;
  text: string;
  options: string[];
  allowMultiple?: boolean;
}

/**
 * Pre-seeded context for wizard entry points that already know what the user
 * is looking at (a datasource's settings page, an Explore pane, …).
 */
export interface WizardSeed {
  /** Scope the build to these datasources (uids). */
  datasourceUids?: string[];
  /** Extra request context, e.g. the queries currently open in Explore. */
  promptHint?: string;
}

/** A single planned panel: its title and the visualization it will use. */
export interface WizardSummaryPanel {
  /** Panel title. */
  title: string;
  /** Visualization in plain language, e.g. "time series", "stat", "table". */
  visualization: string;
}

/** A planned section (tab or row) of the dashboard and the panels it holds. */
export interface WizardSummarySection {
  /** Section name. */
  title: string;
  /** The panels this section contains. */
  panels: WizardSummaryPanel[];
}

/**
 * A user-facing preview of the dashboard the wizard is about to build, shown
 * on the summary step so the user can review the plan before generating.
 * Written in plain language — no datasource uids, tool names, or jargon.
 */
export interface WizardSummary {
  /** Proposed dashboard title. */
  title: string;
  /** One plain-language sentence describing what the dashboard monitors. */
  description: string;
  /** One sentence on the overall structure (how sections are organized). */
  layout?: string;
  /** The sections of the dashboard and the panels planned in each. */
  sections: WizardSummarySection[];
}

/** The metric names a plan's panels will query, grouped by datasource, for existence verification. */
export interface WizardMetricRef {
  /** The datasource uid these metrics belong to. */
  datasourceUid: string;
  /** Metric names the planned panels rely on. */
  names: string[];
}

/** A metric confirmed to exist, with the label names it actually carries. */
export interface WizardVerifiedMetric {
  datasourceUid: string;
  name: string;
  /** Labels present on this metric (excluding __name__); undefined when they couldn't be checked. */
  labels?: string[];
}

/**
 * The assistant's reorganization of the user's free-form request: a precise
 * build prompt, a user-facing summary of it, the data it verified along the
 * way, and clarifying questions when (and only when) the answers genuinely
 * change the dashboard.
 */
export interface WizardRefinement {
  /** The user's request rewritten into a build request the dashboard agent can act on. */
  prompt: string;
  /** Plain-language preview of the planned dashboard, shown for review before building. */
  summary?: WizardSummary;
  /** Datasource uids, metrics, and label/value pairs verified to exist (comma-separated). */
  dataNotes?: string;
  /** The metrics the planned panels query, grouped by datasource — checked for existence. */
  metrics?: WizardMetricRef[];
  /** Metrics confirmed to exist plus the labels each actually carries, used to build safe queries. */
  verifiedMetrics?: WizardVerifiedMetric[];
  /** 0-3 follow-up questions; empty when the request is specific enough. */
  questions: WizardQuestion[];
}
