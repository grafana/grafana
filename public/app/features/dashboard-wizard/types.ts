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

/**
 * The assistant's reorganization of the user's free-form request: a precise
 * build prompt, the data it verified along the way, and clarifying questions
 * when (and only when) the answers genuinely change the dashboard.
 */
export interface WizardRefinement {
  /** The user's request rewritten into a build request the dashboard agent can act on. */
  prompt: string;
  /** Datasource uids, metrics, and label/value pairs verified to exist (comma-separated). */
  dataNotes?: string;
  /** 0-3 follow-up questions; empty when the request is specific enough. */
  questions: WizardQuestion[];
}
