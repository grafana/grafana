/** Types shared by the "Generate dashboard" prompt. */

export interface PromptDatasource {
  uid: string;
  type: string;
  name?: string;
}

/**
 * Pre-seeded context for entry points that already know what the user
 * is looking at (a datasource's settings page, an Explore pane, …).
 */
export interface PromptSeed {
  /** Scope the build to these datasources (uids). */
  datasourceUids?: string[];
  /** Extra request context, e.g. the queries currently open in Explore. */
  promptHint?: string;
}
