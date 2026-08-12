import { type SceneVariable } from '@grafana/scenes';

import { dashboardEditActions } from '../../sidebar/shared';

interface UndoableVariableEditProps {
  description: string;
  source: SceneVariable;
  perform: () => void;
  undo: () => void;
}

/**
 * Variable option editors are shared between the edit pane sidebar and the legacy settings view.
 * Only the sidebar hosts the undo/redo system (publishing an edit action event from the settings
 * view would be lost as nothing performs it), so edits are registered as undoable actions only
 * when the editor is rendered inline in the sidebar.
 */
export function undoableVariableEdit(inline: boolean | undefined, props: UndoableVariableEditProps) {
  if (!inline) {
    props.perform();
    return;
  }

  dashboardEditActions.edit(props);
}
