import { t } from '@grafana/i18n';
import { InlineSwitch } from '@grafana/ui';

import { canEditNotebooks } from '../permissions';

import { type NotebookScene } from './NotebookScene';

/**
 * Switches the notebook between reading and editing. A temporary affordance pending design — the
 * mode itself lives on the scene, so this only flips it.
 */
export function NotebookEditToggle({ notebook }: { notebook: NotebookScene }) {
  const { isEditing } = notebook.useState();

  // Offered only to users who can act on it. The scene refuses to enter edit mode without the same
  // permission, so hiding the control is presentation, not enforcement.
  if (!canEditNotebooks()) {
    return null;
  }

  return (
    <InlineSwitch
      id="notebook-edit-mode"
      label={t('notebooks.view.edit-mode', 'Edit')}
      showLabel
      value={Boolean(isEditing)}
      onChange={(event) => (event.currentTarget.checked ? notebook.onEnterEditMode() : notebook.onExitEditMode())}
    />
  );
}
