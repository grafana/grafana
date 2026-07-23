import { store } from '@grafana/data';

/**
 * Runtime gate for the PromQL co-authoring prototype.
 *
 * grafana-ui has no @grafana/runtime dependency, so we cannot read feature
 * toggles here. We gate on local storage instead (togglable live from devtools
 * during a demo). Defaults ON for this branch (opt-out): only disabled when the
 * flag is explicitly set to 'false'.
 */
export const COAUTHOR_FLAG_KEY = 'grafana.prototypes.promqlCoauthor';

export function isPromqlCoauthorEnabled(): boolean {
  try {
    return store.get(COAUTHOR_FLAG_KEY) !== 'false';
  } catch {
    return false;
  }
}
