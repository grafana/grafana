import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { RadioButtonGroup } from '@grafana/ui';

import { canEditNotebooks } from '../permissions';

import { type NotebookScene } from './NotebookScene';

/**
 * Switches the notebook between reading and editing. Two named modes rather than a switch, so the
 * current one is stated rather than inferred from a toggle's position. The mode itself lives on the
 * scene — this only flips it.
 */
export function NotebookEditToggle({ notebook }: { notebook: NotebookScene }) {
  const { isEditing } = notebook.useState();

  // Offered only to users who can act on it. The scene refuses to enter edit mode without the same
  // permission, so hiding the control is presentation, not enforcement.
  if (!canEditNotebooks()) {
    return null;
  }

  const options: Array<SelectableValue<boolean>> = [
    { label: t('notebooks.view.mode-view', 'View'), value: false, icon: 'eye' },
    { label: t('notebooks.view.mode-edit', 'Edit'), value: true, icon: 'pen' },
  ];

  return (
    <RadioButtonGroup
      id="notebook-edit-mode"
      options={options}
      value={Boolean(isEditing)}
      onChange={(value) => (value ? notebook.onEnterEditMode() : notebook.onExitEditMode())}
    />
  );
}
