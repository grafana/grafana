import { css } from '@emotion/css';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Avatar, IconButton, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import {
  useAddPulseMutation,
  useCloseThreadMutation,
  useDeletePulseMutation,
  useDeleteThreadMutation,
  useEditPulseMutation,
  useListPulsesQuery,
  useMarkReadMutation,
  useReopenThreadMutation,
} from '../api/pulseApi';
import { type Pulse, type PulseBody, type PulseMention, type PulseThread } from '../types';
import { bodyToMarkdown } from '../utils/body';
import { type PanelSuggestion } from '../utils/lookups';

import { PulseComposer } from './PulseComposer';
import { PulseRenderer } from './PulseRenderer';

interface Props {
  thread: PulseThread;
  panels?: PanelSuggestion[];
  currentUserId?: number;
  isAdmin?: boolean;
  onMentionPanel?: (panelId: number) => void;
  onBack?: () => void;
  /** Called after the parent thread is deleted so the parent can navigate back. */
  onThreadDeleted?: () => void;
}

/**
 * PulseThreadView shows the full transcript of a thread plus a reply
 * composer. Marks-as-read on the most recent pulse whenever the list
 * changes (best-effort — failures are silent because they don't affect
 * the user's ability to see new content).
 */
export function PulseThreadView({
  thread,
  panels,
  currentUserId,
  isAdmin = false,
  onMentionPanel,
  onBack,
  onThreadDeleted,
}: Props): ReactNode {
  const styles = useStyles2(getStyles);
  const { data, isLoading } = useListPulsesQuery({ threadUID: thread.uid });
  const [addPulse, addPulseState] = useAddPulseMutation();
  const [editPulse] = useEditPulseMutation();
  const [deletePulse] = useDeletePulseMutation();
  const [deleteThread] = useDeleteThreadMutation();
  const [closeThread] = useCloseThreadMutation();
  const [reopenThread] = useReopenThreadMutation();
  const [markRead] = useMarkReadMutation();

  // Memoize so the empty-array fallback is stable across renders and the
  // mark-read effect's deps don't churn unnecessarily.
  const pulses = useMemo(() => data?.items ?? [], [data?.items]);

  const canManageThread = isAdmin || (currentUserId !== undefined && thread.createdBy === currentUserId);
  const canReopenThread = isAdmin;

  useEffect(() => {
    if (pulses.length === 0) {
      return;
    }
    const last = pulses[pulses.length - 1];
    markRead({ threadUID: thread.uid, req: { lastReadPulseUID: last.uid } }).catch(() => {
      // best-effort
    });
  }, [pulses, thread.uid, markRead]);

  async function handleSubmit(body: PulseBody) {
    await addPulse({ threadUID: thread.uid, req: { body } }).unwrap();
  }

  function handleMention(m: PulseMention) {
    if (m.kind === 'panel' && onMentionPanel) {
      const id = parseInt(m.targetId, 10);
      if (!Number.isNaN(id)) {
        onMentionPanel(id);
      }
    }
  }

  function openDeleteThreadConfirm() {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('pulse.thread.delete-thread-title', 'Delete thread'),
        text: t(
          'pulse.thread.delete-thread-text',
          'This permanently deletes the conversation and all its replies. This cannot be undone.'
        ),
        yesText: t('pulse.thread.delete-thread-confirm', 'Delete thread'),
        yesButtonVariant: 'destructive',
        onConfirm: async () => {
          try {
            await deleteThread({
              threadUID: thread.uid,
              resourceKind: thread.resourceKind,
              resourceUID: thread.resourceUID,
            }).unwrap();
            onThreadDeleted?.();
          } catch {
            // RTK surfaces the error toast; the user can retry from the modal.
          }
        },
      })
    );
  }

  function openCloseThreadConfirm() {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('pulse.thread.close-thread-title', 'Close thread'),
        text: t(
          'pulse.thread.close-thread-text',
          'Closing this thread keeps the history visible but prevents new replies. Admins can reopen it later.'
        ),
        yesText: t('pulse.thread.close-thread-confirm', 'Close thread'),
        onConfirm: async () => {
          try {
            await closeThread({
              threadUID: thread.uid,
              resourceKind: thread.resourceKind,
              resourceUID: thread.resourceUID,
            }).unwrap();
          } catch {
            // toast handles surfacing
          }
        },
      })
    );
  }

  async function handleReopen() {
    try {
      await reopenThread({
        threadUID: thread.uid,
        resourceKind: thread.resourceKind,
        resourceUID: thread.resourceUID,
      }).unwrap();
    } catch {
      // toast handles surfacing
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <Stack alignItems="center" gap={1}>
          {onBack && (
            <IconButton name="arrow-left" aria-label={t('pulse.thread.back', 'Back to threads')} onClick={onBack} />
          )}
          <Text element="h3" weight="medium">
            {thread.title || t('pulse.thread.untitled', 'Conversation')}
          </Text>
          {thread.closed && (
            <span className={styles.closedBadge}>
              <Trans i18nKey="pulse.thread.closed-badge">Closed</Trans>
            </span>
          )}
        </Stack>
        <Stack gap={0.5}>
          {!thread.closed && canManageThread && (
            <IconButton
              name="lock"
              aria-label={t('pulse.thread.close-thread', 'Close thread')}
              tooltip={t('pulse.thread.close-thread', 'Close thread')}
              size="md"
              onClick={openCloseThreadConfirm}
            />
          )}
          {thread.closed && canReopenThread && (
            <IconButton
              name="unlock"
              aria-label={t('pulse.thread.reopen-thread', 'Reopen thread')}
              tooltip={t('pulse.thread.reopen-thread', 'Reopen thread')}
              size="md"
              onClick={handleReopen}
            />
          )}
          {canManageThread && (
            <IconButton
              name="trash-alt"
              aria-label={t('pulse.thread.delete-thread', 'Delete thread')}
              tooltip={t('pulse.thread.delete-thread', 'Delete thread')}
              size="md"
              onClick={openDeleteThreadConfirm}
            />
          )}
        </Stack>
      </div>
      <div className={styles.list}>
        {isLoading && <LoadingPlaceholder text={t('pulse.thread.loading', 'Loading…')} />}
        {!isLoading && pulses.length === 0 && (
          <Text color="secondary">
            <Trans i18nKey="pulse.thread.empty">No pulses yet.</Trans>
          </Text>
        )}
        {pulses.map((p) => (
          <PulseRow
            key={p.uid}
            pulse={p}
            isAuthor={currentUserId !== undefined && p.authorUserId === currentUserId}
            canModify={!thread.closed}
            onEdit={async (body) => {
              await editPulse({
                pulseUID: p.uid,
                threadUID: thread.uid,
                req: { body },
              }).unwrap();
            }}
            onDelete={async () => {
              await deletePulse({ pulseUID: p.uid, threadUID: thread.uid }).unwrap();
            }}
            panels={panels}
            currentUserId={currentUserId}
            onMention={handleMention}
          />
        ))}
      </div>
      {thread.closed ? (
        <Text color="secondary" italic>
          <Trans i18nKey="pulse.thread.closed-notice">
            This thread is closed. Ask an admin to reopen it if more discussion is needed.
          </Trans>
        </Text>
      ) : (
        <PulseComposer
          panels={panels}
          pending={addPulseState.isLoading}
          currentUserId={currentUserId}
          onSubmit={handleSubmit}
          placeholder={t('pulse.thread.reply-placeholder', 'Reply… (@ for users, # for panels)')}
        />
      )}
    </div>
  );
}

interface RowProps {
  pulse: Pulse;
  isAuthor: boolean;
  canModify: boolean;
  onEdit: (body: PulseBody) => Promise<void>;
  onDelete: () => Promise<void>;
  panels?: PanelSuggestion[];
  currentUserId?: number;
  onMention: (m: PulseMention) => void;
}

function PulseRow({
  pulse,
  isAuthor,
  canModify,
  onEdit,
  onDelete,
  panels,
  currentUserId,
  onMention,
}: RowProps): ReactNode {
  const styles = useStyles2(getStyles);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (pulse.deleted) {
    return (
      <div className={styles.row}>
        <Text color="secondary" italic>
          <Trans i18nKey="pulse.thread.tombstone">This pulse was deleted.</Trans>
        </Text>
      </div>
    );
  }

  function openDeleteConfirm() {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('pulse.thread.delete-title', 'Delete pulse'),
        text: t('pulse.thread.delete-text', 'Are you sure you want to delete this pulse?'),
        yesText: t('pulse.thread.delete-confirm', 'Delete'),
        yesButtonVariant: 'destructive',
        onConfirm: async () => {
          setIsDeleting(true);
          try {
            await onDelete();
          } finally {
            setIsDeleting(false);
          }
        },
      })
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <Stack alignItems="center" gap={1}>
          {pulse.authorAvatarUrl ? (
            <Avatar src={pulse.authorAvatarUrl} alt={authorDisplayLabel(pulse)} width={3} height={3} />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true" />
          )}
          <Text weight="medium">{authorDisplayLabel(pulse)}</Text>
          <Text color="secondary" variant="bodySmall">
            {new Date(pulse.created).toLocaleString()}
            {pulse.edited && ' · ' + t('pulse.thread.edited', '(edited)')}
          </Text>
        </Stack>
        {isAuthor && canModify && (
          <Stack gap={0.5}>
            <IconButton
              name="edit"
              aria-label={t('pulse.thread.edit', 'Edit pulse')}
              size="sm"
              onClick={() => setIsEditing((v) => !v)}
            />
            <IconButton
              name="trash-alt"
              aria-label={t('pulse.thread.delete', 'Delete pulse')}
              size="sm"
              onClick={openDeleteConfirm}
              disabled={isDeleting}
            />
          </Stack>
        )}
      </div>
      <div className={styles.body}>
        {isEditing ? (
          <PulseComposerForEdit
            pulse={pulse}
            panels={panels}
            currentUserId={currentUserId}
            onCancel={() => setIsEditing(false)}
            onSubmit={async (body) => {
              await onEdit(body);
              setIsEditing(false);
            }}
          />
        ) : (
          <PulseRenderer body={pulse.body} onMentionClick={onMention} />
        )}
      </div>
    </div>
  );
}

interface EditProps {
  pulse: Pulse;
  panels?: PanelSuggestion[];
  currentUserId?: number;
  onSubmit: (body: PulseBody) => Promise<void>;
  onCancel: () => void;
}

/**
 * PulseComposerForEdit derives the markdown source + mention sidecar
 * from an existing pulse and seeds the composer with them. Pulses
 * authored before markdown support shipped have no `body.markdown`, so
 * we synthesize one from the AST (mentions become inline-code tokens).
 */
function PulseComposerForEdit({ pulse, panels, currentUserId, onSubmit, onCancel }: EditProps): ReactNode {
  const seed = useMemo(() => bodyToMarkdown(pulse.body), [pulse.body]);
  return (
    <PulseComposer
      panels={panels}
      initialMarkdown={seed.text}
      initialMentions={seed.mentions}
      currentUserId={currentUserId}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

/**
 * authorDisplayLabel prefers the user's full name, then their login,
 * and finally falls back to a numeric id when neither is populated.
 * The backend resolves these on the listPulses response so the picker
 * is consistent regardless of where a pulse originated.
 */
function authorDisplayLabel(pulse: Pulse): string {
  if (pulse.authorKind === 'service_account') {
    const label = pulse.authorName || pulse.authorLogin;
    if (label) {
      return t('pulse.thread.author-bot-named', '{{name}} (automation)', { name: label });
    }
    return t('pulse.thread.author-bot', 'Automation #{{id}}', { id: pulse.authorUserId });
  }
  if (pulse.authorName) {
    return pulse.authorName;
  }
  if (pulse.authorLogin) {
    return pulse.authorLogin;
  }
  return t('pulse.thread.author-user', 'User #{{id}}', { id: pulse.authorUserId });
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    height: '100%',
  }),
  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  closedBadge: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }),
  list: css({
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingRight: theme.spacing(1),
  }),
  row: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),
  rowHeader: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
  body: css({
    paddingLeft: theme.spacing(4),
    color: theme.colors.text.primary,
  }),
  avatarFallback: css({
    display: 'inline-block',
    width: theme.spacing(3),
    height: theme.spacing(3),
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.background.canvas,
  }),
});
