/** Types shared by the "Generate dashboard" wizard. */

export interface WizardDatasource {
  uid: string;
  type: string;
  name?: string;
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
