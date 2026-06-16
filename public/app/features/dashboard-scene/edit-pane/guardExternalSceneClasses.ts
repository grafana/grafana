import { SceneVariableSet } from '@grafana/scenes';

import { DashboardUI } from './editActionGuard';

/**
 * Dev-only runtime guards for scene-object classes that live in @grafana/scenes
 * and therefore can't be annotated with `@DashboardUI` at their definition.
 *
 * Calling `DashboardUI(Class)` at runtime patches the class prototype exactly like
 * the decorator would (and also covers already-created instances). It's a no-op in
 * production; gated out of tests as well to avoid flooding test output, since these
 * library classes are shared app-wide and change state frequently outside of edit
 * actions.
 *
 * Add more classes here while auditing for state changes that bypass Dashboard Edit Actions.
 */
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  DashboardUI(SceneVariableSet);
}
