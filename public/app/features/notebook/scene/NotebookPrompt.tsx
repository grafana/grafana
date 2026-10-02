import type * as H from 'history';
import { memo, useContext, useEffect, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { ConfirmModal, ModalsContext } from '@grafana/ui';
import { Prompt } from 'app/core/components/FormPrompt/Prompt';

import { type NotebookScene } from './NotebookScene';

interface NotebookPromptProps {
  scene: NotebookScene;
}

/**
 * Whether leaving the notebook right now risks losing something: autosave has not settled on
 * `idle` (nothing ever edited, or a draft with no autosave at all) or `saved`. Covers the
 * ordinary debounce window as well as an outright failure, the same way DashboardScene's own
 * navigation prompt treats any `isDirty` session as worth asking about.
 */
export function needsConfirmBeforeLeaving(scene: NotebookScene): boolean {
  const { status } = scene.autosave.state;
  return Boolean(scene.state.isEditing) && status !== 'idle' && status !== 'saved';
}

/**
 * Warns before the user leaves a notebook that autosave has not finished writing, so they get a
 * chance to wait rather than find out later. Modeled on DashboardScene's own `DashboardPrompt`:
 * `history.block` for in-app navigation, `beforeunload` for a hard reload or tab close.
 *
 * Deliberately not routed through `ShowConfirmModalEvent`, even though the message this shows
 * overlaps with the autosave conflict prompt: both render through the same global `ModalsContext`
 * slot (see `ModalsContextProvider`), so publishing either one always replaces whatever the other
 * put there — there is no way for the two to stack, by construction of that shared slot, not
 * anything this component has to coordinate itself.
 */
export const NotebookPrompt = memo(({ scene }: NotebookPromptProps) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const originalPath = useMemo(() => locationService.getLocation().pathname, [scene]);
  const { showModal, hideModal } = useContext(ModalsContext);

  useEffect(() => {
    const handleUnload = (event: BeforeUnloadEvent) => {
      if (!needsConfirmBeforeLeaving(scene)) {
        return;
      }
      event.preventDefault();
      // No browser actually displays this message anymore.
      // But Chrome requires it to be defined else the popup won't show.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [scene]);

  const onHistoryBlock = (location: H.Location) => {
    // Edit-mode toggling and url sync both rewrite the query string on this same notebook; only an
    // actual change of page is what this needs to ask about.
    if (originalPath === location.pathname) {
      return true;
    }

    if (!needsConfirmBeforeLeaving(scene)) {
      return true;
    }

    const isConflict = Boolean(scene.autosave.state.isConflict);

    showModal(ConfirmModal, {
      // Overwritten by ModalsContextProvider's own `isOpen: true`/`onDismiss` anyway (it merges
      // these props with its own); set here only so this satisfies ConfirmModalProps.
      isOpen: true,
      title: isConflict
        ? t('notebook.leave-prompt.conflict-title', 'Someone else has updated this notebook')
        : t('notebook.leave-prompt.saving-title', 'This notebook is still saving'),
      body: isConflict
        ? t(
            'notebook.leave-prompt.conflict-body',
            'Your changes could not be saved because someone else updated this notebook first. If you leave now, those changes will be lost.'
          )
        : t(
            'notebook.leave-prompt.saving-body',
            'Your most recent changes are still being saved. If you leave now, they might not be saved.'
          ),
      confirmText: t('notebook.leave-prompt.leave', 'Leave anyway'),
      confirmVariant: 'destructive',
      dismissText: t('notebook.leave-prompt.stay', 'Stay'),
      onConfirm: () => {
        hideModal();
        moveToBlockedLocationAfterReactStateUpdate(location);
      },
      onDismiss: hideModal,
    });

    return false;
  };

  return <Prompt when={true} message={onHistoryBlock} />;
});

NotebookPrompt.displayName = 'NotebookPrompt';

function moveToBlockedLocationAfterReactStateUpdate(location: H.Location) {
  setTimeout(() => locationService.push(location), 10);
}
