import type * as H from 'history';
import { memo, useContext, useEffect, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { ConfirmModal, type ConfirmModalProps, ModalsContext } from '@grafana/ui';
import { Prompt } from 'app/core/components/FormPrompt/Prompt';

import { NotebookAnalytics } from '../analytics/main';
import {
  NOTEBOOK_LEAVE_PROMPT_REASON,
  NOTEBOOK_LEAVE_PROMPT_RESOLUTION,
  type NotebookLeavePromptResolution,
} from '../analytics/types';

import { type NotebookScene } from './NotebookScene';

interface NotebookPromptProps {
  scene: NotebookScene;
}

interface LeavePromptModalProps extends ConfirmModalProps {
  /** Called when the user closes the prompt without leaving: Stay, the close button, or Escape. */
  onStay: () => void;
}

/**
 * ModalsContext hands every modal its own `onDismiss`, replacing the one the caller gave, so the
 * answer to a close has to be read here, where that replacement is the prop to call through.
 */
function LeavePromptModal({ onStay, onDismiss, ...props }: LeavePromptModalProps) {
  return (
    <ConfirmModal
      {...props}
      onDismiss={() => {
        onStay();
        onDismiss();
      }}
    />
  );
}

export function needsConfirmBeforeLeaving(scene: NotebookScene): boolean {
  const { status } = scene.autosave.state;
  return (
    Boolean(scene.state.isEditing) &&
    (scene.state.body.hasPendingVizChanges() || (status !== 'idle' && status !== 'saved'))
  );
}

/**
 * Composer holds its edits back until it ends. Leaving the page in the app ends it, which saves them, so
 * only a reload or a closed tab, which never reaches that save, needs asking about.
 */
function holdsComposerEdits(scene: NotebookScene): boolean {
  const { status } = scene.autosave.state;
  return Boolean(scene.state.isComposing) && (status === 'pending' || status === 'saving');
}

/**
 * Warns before the user leaves a notebook that autosave has not finished writing, so they get a
 * chance to wait rather than find out later. Modeled on DashboardScene's own `DashboardPrompt`:
 * `history.block` for in-app navigation, `beforeunload` for a hard reload or tab close.
 */
export const NotebookPrompt = memo(({ scene }: NotebookPromptProps) => {
  const originalPath = useMemo(() => locationService.getLocation().pathname, []);
  const { showModal, hideModal } = useContext(ModalsContext);
  const confirmedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const handleUnload = (event: BeforeUnloadEvent) => {
      if (!needsConfirmBeforeLeaving(scene) && !holdsComposerEdits(scene)) {
        return;
      }
      event.preventDefault();
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

    if (confirmedPathRef.current === location.pathname) {
      confirmedPathRef.current = null;
      return true;
    }

    if (!needsConfirmBeforeLeaving(scene)) {
      return true;
    }

    const isConflict = Boolean(scene.autosave.state.isConflict);
    const reason = isConflict ? NOTEBOOK_LEAVE_PROMPT_REASON.CONFLICT : NOTEBOOK_LEAVE_PROMPT_REASON.SAVING;
    const report = (resolution: NotebookLeavePromptResolution) =>
      NotebookAnalytics.leavePromptResolved(scene.state.uid ?? '', reason, resolution);

    showModal(LeavePromptModal, {
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
        report(NOTEBOOK_LEAVE_PROMPT_RESOLUTION.LEAVE);
        confirmedPathRef.current = location.pathname;
        hideModal();
        moveToBlockedLocationAfterReactStateUpdate(location);
      },
      onDismiss: hideModal,
      onStay: () => report(NOTEBOOK_LEAVE_PROMPT_RESOLUTION.STAY),
    });

    return false;
  };

  return <Prompt when={true} message={onHistoryBlock} />;
});

NotebookPrompt.displayName = 'NotebookPrompt';

function moveToBlockedLocationAfterReactStateUpdate(location: H.Location) {
  setTimeout(() => locationService.push(location), 10);
}
