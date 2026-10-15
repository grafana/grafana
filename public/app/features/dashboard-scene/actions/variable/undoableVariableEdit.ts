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
 * Variable editors are rendered both inline in the dashboard sidebar and in the dashboard settings page. The
 * settings page has no undo history (the sidebar that records edit actions is not active there), so editors pass
 * their `inline` flag here and changes made in the settings page are applied without being recorded.
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
