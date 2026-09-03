import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, Stack, Text, Tooltip } from '@grafana/ui';

import { type NotebookAutosave, type NotebookSaveStatus as SaveStatus } from './NotebookAutosave';

/** The same two seconds `AutoSaveField` waits, so a saved notebook reads like the rest of Grafana. */
const SAVED_VISIBLE_MS = 2000;

/**
 * Most saves land sooner than this. A word that appears and disappears in under a sixth of a second is a
 * flicker rather than something anyone can read, so only a save slow enough to notice says it is saving.
 */
const SAVING_SHOWN_AFTER_MS = 150;

/**
 * What the notebook's autosave is doing, in words. There is no save button, so nothing else tells a user
 * whether their work is safe, including when the assistant is the one writing.
 *
 * Nothing is shown while `idle`. Saying "Saved" about a notebook nobody has touched claims something we
 * did not do, and a label that is always there stops being information.
 */
export function NotebookSaveStatus({ autosave }: { autosave: NotebookAutosave }) {
  const { status, errorMessage } = autosave.useState();
  const [savedExpired, setSavedExpired] = useState(false);
  const [savingShown, setSavingShown] = useState(false);

  useEffect(() => {
    setSavedExpired(false);

    if (status !== 'saved') {
      return;
    }

    const timeout = setTimeout(() => setSavedExpired(true), SAVED_VISIBLE_MS);
    return () => clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    setSavingShown(false);

    if (status !== 'saving') {
      return;
    }

    const timeout = setTimeout(() => setSavingShown(true), SAVING_SHOWN_AFTER_MS);
    return () => clearTimeout(timeout);
  }, [status]);

  // A save always starts from unsaved changes, so a save too quick to announce keeps saying that instead.
  const shown = status === 'saving' && !savingShown ? 'pending' : status;

  if (shown === 'idle' || (shown === 'saved' && savedExpired)) {
    return null;
  }

  const labels: Record<Exclude<SaveStatus, 'idle'>, string> = {
    pending: t('notebooks.save-status.pending', 'Unsaved changes'),
    saving: t('notebooks.save-status.saving', 'Saving…'),
    saved: t('notebooks.save-status.saved', 'Saved'),
    error: t('notebooks.save-status.failed', 'Save failed'),
  };

  const label = (
    <Text variant="bodySmall" color="secondary">
      {labels[shown]}
    </Text>
  );

  return (
    <Stack gap={0.5} alignItems="center">
      {/* The message is the only thing saying WHY it failed, and too long to sit in the row. */}
      {shown === 'error' && errorMessage ? (
        <Tooltip content={errorMessage}>
          <span>{label}</span>
        </Tooltip>
      ) : (
        label
      )}
      {shown === 'error' ? (
        <Button variant="secondary" fill="text" size="sm" onClick={() => autosave.retry()}>
          {t('notebooks.save-status.retry', 'Retry')}
        </Button>
      ) : null}
    </Stack>
  );
}
