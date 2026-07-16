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

/**
 * A planned section of the dashboard: a tab or a row, and what it holds.
 * Mirrors the V2 dashboard schema: a section holds EITHER panels directly OR
 * nested sections (rows inside a tab, tabs inside a row, …), never both.
 * Normalization enforces the invariant, so consumers can trust it.
 */
export interface WizardSummarySection {
  /** Section name. */
  title: string;
  /** How this section is realized in the dashboard. */
  kind: 'tab' | 'row';
  /** The panels this section contains directly; empty when it holds nested sections. */
  panels: WizardSummaryPanel[];
  /** Inner sections nested inside this one; unset when the section holds panels. */
  sections?: WizardSummarySection[];
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
  /** Top-level organization: tabs across the top or stacked rows. */
  structure: 'tabs' | 'rows';
  /** The sections of the dashboard, each a tab or row per the V2 layout schema. */
  sections: WizardSummarySection[];
  /** Names of the template variables that will scope the dashboard, without the $ prefix. */
  variables: string[];
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
