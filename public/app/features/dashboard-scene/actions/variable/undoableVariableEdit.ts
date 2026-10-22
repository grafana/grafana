import { type SceneVariable } from '@grafana/scenes';

import { type DashboardActionMeta } from '../../sidebar/events';
import { edit } from '../utils/edit';

interface UndoableVariableEditProps {
  meta: DashboardActionMeta;
  source: SceneVariable;
  description: string;
  perform: () => void;
  undo: () => void;
}

/**
 * Applies a change made in a variable editor and records it in the undo history when `shouldRecord` is true.
 *
 * Pass false for settings-page edits or unchanged values to apply the change without recording history.
 * The caller decides whether the edit should be recorded; false does not skip performing the change.
 */
export function undoableVariableEdit(
  shouldRecord: boolean | undefined,
  { meta, source, description, perform, undo }: UndoableVariableEditProps
) {
  if (!shouldRecord) {
    perform();
    return;
  }

  edit({ meta, source, description, perform, undo });
}
