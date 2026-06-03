import { css } from '@emotion/css';
import { Fragment, useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, IconButton, TextArea, useStyles2 } from '@grafana/ui';

import { formatRelative, timestampHint } from './formatTime';
import { type CommentThread, type User } from './types';

interface Props {
  thread: CommentThread;
  number: number;
  x: number;
  y: number;
  onReply: (body: string) => void | Promise<unknown>;
  onToggleResolve: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onJumpTo: () => void;
  onClose: () => void;
}

export function CommentThreadView({
  thread,
  number,
  x,
  y,
  onReply,
  onToggleResolve,
  onDelete,
  onJumpTo,
  onClose,
}: Props) {
  const styles = useStyles2(getStyles);
  const [reply, setReply] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const headerHint = timestampHint(thread.context.timeRange, thread.anchor.xNorm);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function submitReply() {
    const trimmed = reply.trim();
    if (!trimmed) {
      return;
    }
    await onReply(trimmed);
    setReply('');
  }

  async function copyLink() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('thread', String(thread.id));
      await navigator.clipboard.writeText(url.toString());
    } catch {
      // clipboard unavailable; PoC silently no-ops
    }
  }

  async function handleDeleteClick() {
    if (window.confirm(t('dashboard-scene.comments-thread.delete-confirm', 'Delete this thread?'))) {
      await onDelete();
    }
  }

  const title = thread.context.panelTitle || t('dashboard-scene.comments-thread.panel-fallback', 'Panel');

  return (
    <div ref={ref} className={styles.popover} data-thread-number={number} style={{ left: x, top: y }}>
      <div className={styles.header}>
        <span className={styles.redDot} aria-hidden />
        <span className={styles.headerTitle}>
          {title}
          {headerHint && <span className={styles.headerHint}> • {headerHint}</span>}
        </span>
        <button type="button" className={styles.jumpButton} onClick={onJumpTo}>
          <Trans i18nKey="dashboard-scene.comments-thread.jump-to">Jump to</Trans>
        </button>
        <div className={styles.headerActions}>
          <IconButton
            name={thread.resolved ? 'check-circle' : 'check'}
            size="md"
            onClick={onToggleResolve}
            tooltip={
              thread.resolved
                ? t('dashboard-scene.comments-thread.reopen', 'Reopen')
                : t('dashboard-scene.comments-thread.resolve', 'Mark resolved')
            }
          />
          <IconButton
            name="link"
            size="md"
            onClick={copyLink}
            tooltip={t('dashboard-scene.comments-thread.copy-link', 'Copy link')}
          />
          <IconButton
            name="ellipsis-v"
            size="md"
            onClick={handleDeleteClick}
            tooltip={t('dashboard-scene.comments-thread.more', 'More')}
          />
          <IconButton
            name="times"
            size="md"
            onClick={onClose}
            tooltip={t('dashboard-scene.comments-thread.close', 'Close')}
          />
        </div>
      </div>

      {thread.resolved && (
        <div className={styles.resolvedBanner}>
          <Icon name="check-circle" size="sm" />
          <Trans i18nKey="dashboard-scene.comments-thread.resolved-banner">Resolved</Trans>
        </div>
      )}

      <div className={styles.messages}>
        {thread.messages.map((msg) => (
          <div key={msg.id} className={styles.message}>
            <UserAvatar user={msg.author} className={styles.avatar} />
            <div className={styles.messageBody}>
              <div className={styles.messageMeta}>
                <span className={styles.authorName}>{msg.author.name}</span>
                <span className={styles.messageTime}>{formatRelative(msg.createdAt)}</span>
              </div>
              <div className={styles.messageText}>{renderBodyWithMentions(msg.body, styles.mention)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.composer}>
        <TextArea
          value={reply}
          onChange={(e) => setReply(e.currentTarget.value)}
          placeholder={t(
            'dashboard-scene.comments-thread.reply-placeholder',
            'Add a comment. Use @ to mention.'
          )}
          rows={2}
          className={styles.composerInput}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void submitReply();
            }
          }}
        />
        <div className={styles.composerFooter}>
          <div className={styles.composerLeftIcons}>
            <Icon name="at" size="md" className={styles.composerIcon} />
            <Icon name="camera" size="md" className={styles.composerIcon} />
            <Icon name="attach" size="md" className={styles.composerIcon} />
          </div>
          <span className={styles.kbdHint}>
            <Trans i18nKey="dashboard-scene.comments-thread.kbd-hint">⌘↵ post · Esc cancel</Trans>
          </span>
          <Button size="sm" variant="primary" onClick={() => void submitReply()} disabled={!reply.trim()}>
            <Trans i18nKey="dashboard-scene.comments-thread.reply">Reply</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ user, className }: { user: User; className: string }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name} className={className} />;
  }
  return (
    <span className={className} aria-label={user.name}>
      {user.name.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function renderBodyWithMentions(body: string, mentionClass: string) {
  const parts = body.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className={mentionClass}>
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    position: 'fixed',
    transform: 'translate(12px, 12px)',
    width: 360,
    maxHeight: '75vh',
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    zIndex: 10001,
    pointerEvents: 'auto',
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1, 1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.canvas,
  }),
  redDot: css({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: theme.colors.primary.main,
    flexShrink: 0,
  }),
  headerTitle: css({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  headerHint: css({
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightRegular,
  }),
  jumpButton: css({
    padding: theme.spacing(0.5, 1.25),
    background: theme.colors.info.main,
    color: theme.colors.info.contrastText,
    border: 'none',
    borderRadius: theme.shape.radius.pill,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    cursor: 'pointer',
    flexShrink: 0,
    '&:hover': {
      background: theme.colors.info.shade,
    },
  }),
  headerActions: css({
    display: 'flex',
    gap: theme.spacing(0.25),
    flexShrink: 0,
    color: theme.colors.text.secondary,
  }),
  resolvedBanner: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 2),
    background: theme.colors.success.transparent,
    color: theme.colors.success.text,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  messages: css({
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(1.5, 2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    background: theme.colors.background.secondary,
  }),
  message: css({
    display: 'flex',
    gap: theme.spacing(1),
  }),
  messageBody: css({
    flex: 1,
    minWidth: 0,
  }),
  messageMeta: css({
    display: 'flex',
    gap: theme.spacing(0.75),
    alignItems: 'baseline',
    marginBottom: theme.spacing(0.25),
  }),
  authorName: css({
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.primary,
  }),
  messageTime: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  messageText: css({
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.primary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: theme.typography.body.lineHeight,
  }),
  mention: css({
    color: theme.colors.info.text,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  avatar: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: theme.colors.background.canvas,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    flexShrink: 0,
    overflow: 'hidden',
    objectFit: 'cover',
  }),
  composer: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1.5, 2, 1.5, 2),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.canvas,
    gap: theme.spacing(1),
  }),
  composerInput: css({
    background: theme.colors.background.canvas,
    border: 'none',
    padding: 0,
    resize: 'none',
    '&:focus': {
      boxShadow: 'none',
      border: 'none',
    },
  }),
  composerFooter: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  composerLeftIcons: css({
    display: 'flex',
    gap: theme.spacing(1),
    color: theme.colors.text.secondary,
  }),
  composerIcon: css({
    cursor: 'not-allowed',
    opacity: 0.6,
  }),
  kbdHint: css({
    flex: 1,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    textAlign: 'right',
  }),
});
