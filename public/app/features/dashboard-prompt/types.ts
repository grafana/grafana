/** Types shared by the "Generate dashboard" prompt. */

export interface PromptDatasource {
  uid: string;
  type: string;
  name?: string;
}

/**
 * Pre-seeded context for entry points that already know what the user is
 * looking at — today that's a datasource's settings page.
 */
export interface PromptSeed {
  /** Scope the build to these datasources (uids). */
  datasourceUids?: string[];
  /** Extra request context describing where the user came from. */
  promptHint?: string;
  /**
   * Folder the draft should be created in, matching what the entry point's
   * sibling "New dashboard" link would do. Affects where the dashboard lands,
   * not what the assistant is told.
   */
  folderUid?: string;
}
