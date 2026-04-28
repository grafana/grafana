import { css } from '@emotion/css';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Avatar, Button, IconButton, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';

import {
  useAddPulseMutation,
  useDeletePulseMutation,
  useListPulsesQuery,
  useMarkReadMutation,
} from '../api/pulseApi';
import { type Pulse, type PulseMention, type PulseThread } from '../types';
import { type BodyToken, tokensToBody } from '../utils/body';
import { type PanelSuggestion } from '../utils/lookups';

import { PulseComposer } from './PulseComposer';
import { PulseRenderer } from './PulseRenderer';

interface Props {
  thread: PulseThread;
  panels?: PanelSuggestion[];
  currentUserId?: number;
  onMentionPanel?: (panelId: number) => void;
  onBack?: () => void;
}

/**
 * PulseThreadView shows the full transcript of a thread plus a reply
 * composer. Marks-as-read on the most recent pulse whenever the list
 * changes (best-effort — failures are silent because they don't affect
 * the user's ability to see new content).
 */
export function PulseThreadView({ thread, panels, currentUserId, onMentionPanel, onBack }: Props): ReactNode {
  const styles = useStyles2(getStyles);
  const { data, isLoading } = useListPulsesQuery({ threadUID: thread.uid });
  const [addPulse, addPulseState] = useAddPulseMutation();
  const [deletePulse] = useDeletePulseMutation();
  const [markRead] = useMarkReadMutation();

  // Memoize so the empty-array fallback is stable across renders and the
  // mark-read effect's deps don't churn unnecessarily.
  const pulses = useMemo(() => data?.items ?? [], [data?.items]);

  useEffect(() => {
    if (pulses.length === 0) {
      return;
    }
    const last = pulses[pulses.length - 1];
    markRead({ threadUID: thread.uid, req: { lastReadPulseUID: last.uid } }).catch(() => {
      // best-effort
    });
  }, [pulses, thread.uid, markRead]);

  function handleSubmit(tokens: BodyToken[]) {
    addPulse({ threadUID: thread.uid, req: { body: tokensToBody(tokens) } });
  }

  function handleMention(m: PulseMention) {
    if (m.kind === 'panel' && onMentionPanel) {
      const id = parseInt(m.targetId, 10);
      if (!Number.isNaN(id)) {
        onMentionPanel(id);
      }
    }
  }

  return (
    <div className={styles.wrap}>
      <Stack alignItems="center" gap={1}>
        {onBack && <IconButton name="arrow-left" aria-label={t('pulse.thread.back', 'Back to threads')} onClick={onBack} />}
        <Text element="h3" weight="medium">
          {thread.title || t('pulse.thread.untitled', 'Conversation')}
        </Text>
      </Stack>
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
            onDelete={() => deletePulse({ pulseUID: p.uid, threadUID: thread.uid })}
            onMention={handleMention}
          />
        ))}
      </div>
      <PulseComposer
        panels={panels}
        pending={addPulseState.isLoading}
        onSubmit={handleSubmit}
        placeholder={t('pulse.thread.reply-placeholder', 'Reply… (@ for users, # for panels)')}
      />
    </div>
  );
}

interface RowProps {
  pulse: Pulse;
  isAuthor: boolean;
  onDelete: () => void;
  onMention: (m: PulseMention) => void;
}

function PulseRow({ pulse, isAuthor, onDelete, onMention }: RowProps): ReactNode {
  const styles = useStyles2(getStyles);
  const [confirming, setConfirming] = useState(false);

  if (pulse.deleted) {
    return (
      <div className={styles.row}>
        <Text color="secondary" italic>
          <Trans i18nKey="pulse.thread.tombstone">This pulse was deleted.</Trans>
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <Stack alignItems="center" gap={1}>
          <Avatar src={`/avatar/${pulse.authorUserId}`} alt={`user-${pulse.authorUserId}`} width={3} height={3} />
          <Text weight="medium">
            {pulse.authorKind === 'service_account'
              ? t('pulse.thread.author-bot', 'Automation #{{id}}', { id: pulse.authorUserId })
              : t('pulse.thread.author-user', 'User #{{id}}', { id: pulse.authorUserId })}
          </Text>
          <Text color="secondary" variant="bodySmall">
            {new Date(pulse.created).toLocaleString()}
            {pulse.edited && ' · ' + t('pulse.thread.edited', '(edited)')}
          </Text>
        </Stack>
        {isAuthor && (
          <Stack gap={0}>
            {!confirming && (
              <IconButton
                name="trash-alt"
                aria-label={t('pulse.thread.delete', 'Delete pulse')}
                size="sm"
                onClick={() => setConfirming(true)}
              />
            )}
            {confirming && (
              <Stack gap={0.5}>
                <Button size="sm" variant="destructive" onClick={onDelete}>
                  {t('pulse.thread.delete-confirm', 'Delete')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                  {t('pulse.thread.delete-cancel', 'Cancel')}
                </Button>
              </Stack>
            )}
          </Stack>
        )}
      </div>
      <div className={styles.body}>
        <PulseRenderer body={pulse.body} onMentionClick={onMention} />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    height: '100%',
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
});
