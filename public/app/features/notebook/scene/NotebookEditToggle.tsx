import { useSyncExternalStore } from 'react';

import { type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaNotebookComposer } from '@grafana/runtime/internal';
import { RadioButtonGroup } from '@grafana/ui';
import {
  clearPendingComposerEnterRequest,
  getPendingComposerEnterTarget,
  subscribeToComposerEnterRequests,
} from 'app/features/dashboard-scene/composer/composerEntryRequests';
import { useAssistantComposerEntry } from 'app/features/dashboard-scene/composer/useAssistantComposerEntry';

import { canEnterNotebookComposer } from '../composer/notebookComposerAccess';
import { canEditNotebooks } from '../permissions';

import { useIsNotebookEmbedded } from './NotebookEmbeddedContext';
import { type NotebookScene } from './NotebookScene';

type NotebookMode = 'view' | 'edit' | 'composer';

/**
 * Switches the notebook between reading, editing and Composer. Named modes rather than a switch, so the
 * current one is stated rather than inferred from a toggle's position. Reading and editing live on the
 * scene; this only flips them.
 *
 * Composer is offered as the dashboard mode picker offers it: on the notebook's own route, while its flag is
 * on, Assistant has registered and listens for notebook entry requests, and Composer can start. Choosing it asks Assistant to enter, and shows
 * Composer until the request settles: a session that starts keeps it, one that fails or expires falls back
 * to the mode the notebook is still in. View or Edit from Composer ends the session first.
 */
export function NotebookEditToggle({ notebook }: { notebook: NotebookScene }) {
  const { isEditing, isComposing, uid } = notebook.useState();
  // Read for its re-render: canEnterNotebookComposer reads the flag itself.
  useFlagGrafanaNotebookComposer();
  const embedded = useIsNotebookEmbedded();
  const entry = useAssistantComposerEntry('notebook');
  const pendingTarget = useSyncExternalStore(subscribeToComposerEnterRequests, getPendingComposerEnterTarget);
  const requested = pendingTarget?.resource === 'notebook' && pendingTarget.uid === uid;

  // Offered only to users who can act on it. The scene refuses to enter edit mode without the same
  // permission, so hiding the control is presentation, not enforcement.
  if (!canEditNotebooks()) {
    return null;
  }

  const composerOffered =
    Boolean(isComposing) ||
    (!embedded && entry !== undefined && Boolean(uid) && canEnterNotebookComposer(notebook, { onRoute: true }).ok);

  const options: Array<SelectableValue<NotebookMode>> = [
    { label: t('notebooks.view.mode-view', 'View'), value: 'view', icon: 'eye' },
    { label: t('notebooks.view.mode-edit', 'Edit'), value: 'edit', icon: 'pen' },
  ];
  if (composerOffered) {
    options.push({
      label: t('notebook.composer.toggle', 'Composer'),
      value: 'composer',
      icon: 'ai-select',
      description: t('notebook.composer.toggle-enter', 'Point at cells and regions and ask Assistant to change them'),
    });
  }

  const mode: NotebookMode = isComposing || (composerOffered && requested) ? 'composer' : isEditing ? 'edit' : 'view';

  const onChange = (value: NotebookMode) => {
    if (value === 'composer') {
      if (!isComposing && uid && entry) {
        entry.request({ resource: 'notebook', uid });
      }
      return;
    }
    // Another mode withdraws a request Assistant has not acted on yet.
    if (requested) {
      clearPendingComposerEnterRequest();
    }
    if (value === 'edit') {
      // Leaves Composer first, which saves what it applied.
      notebook.onEnterEditMode();
    } else if (isComposing) {
      notebook.getComposerSession()?.exit();
    } else {
      notebook.onExitEditMode();
    }
  };

  return (
    <RadioButtonGroup
      id="notebook-edit-mode"
      data-testid={selectors.pages.Notebooks.Item.editModeToggle}
      options={options}
      value={mode}
      onChange={onChange}
    />
  );
}
