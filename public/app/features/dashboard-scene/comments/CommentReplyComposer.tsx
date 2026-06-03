import { css } from '@emotion/css';
import { useCallback, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, Spinner, TextArea, useStyles2 } from '@grafana/ui';

import { listAssistantChats } from './assistantChatRegistry';
import { ASSISTANT_MENTION_HANDLE, CHAT_MENTION_PREFIX } from './mentions';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  disabled?: boolean;
  isGenerating?: boolean;
  mentionsEnabled?: boolean;
  rows?: number;
  placeholder?: string;
  submitLabel?: string;
}

export function CommentReplyComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  isGenerating,
  mentionsEnabled = false,
  rows = 2,
  placeholder,
  submitLabel,
}: Props) {
  const styles = useStyles2(getStyles);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const mentionOptions = useMemo(() => {
    const options = [{ id: 'assistant', label: ASSISTANT_MENTION_HANDLE, description: 'Ask Grafana Assistant' }];
    if (mentionsEnabled) {
      for (const chat of listAssistantChats()) {
        options.push({
          id: `chat:${chat.chatId}`,
          label: `${CHAT_MENTION_PREFIX}:${chat.chatId}`,
          description: chat.title,
        });
      }
    }
    const q = mentionQuery.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)
    );
  }, [mentionQuery, mentionsEnabled]);

  const updateMentionState = useCallback(
    (next: string) => {
      onChange(next);
      const el = textAreaRef.current;
      if (!el || !mentionsEnabled) {
        setShowMentions(false);
        return;
      }
      const cursor = el.selectionStart ?? next.length;
      const before = next.slice(0, cursor);
      const at = before.lastIndexOf('@');
      if (at === -1) {
        setShowMentions(false);
        return;
      }
      const fragment = before.slice(at + 1);
      if (/\s/.test(fragment)) {
        setShowMentions(false);
        return;
      }
      setMentionQuery(fragment);
      setShowMentions(true);
    },
    [mentionsEnabled, onChange]
  );

  const insertMention = useCallback(
    (token: string) => {
      const el = textAreaRef.current;
      const cursor = el?.selectionStart ?? value.length;
      const before = value.slice(0, cursor);
      const after = value.slice(cursor);
      const at = before.lastIndexOf('@');
      const prefix = at >= 0 ? value.slice(0, at) : value;
      const spacer = prefix && !prefix.endsWith(' ') ? ' ' : '';
      const next = `${prefix}${spacer}${token} ${after}`.replace(/\s+/g, ' ').trimStart();
      onChange(next.endsWith(' ') ? next : `${next} `);
      setShowMentions(false);
      requestAnimationFrame(() => el?.focus());
    },
    [onChange, value]
  );

  return (
    <div className={styles.wrapper}>
      <TextArea
        ref={textAreaRef}
        value={value}
        onChange={(e) => updateMentionState(e.currentTarget.value)}
        placeholder={
          placeholder ??
          (mentionsEnabled
            ? t(
                'dashboard-scene.comments-reply.placeholder-mentions',
                'Add a comment. Use @assistant or @chat:ID to involve Assistant.'
              )
            : t('dashboard-scene.comments-thread.reply-placeholder', 'Add a comment. Use @ to mention.'))
        }
        rows={rows}
        className={styles.input}
        disabled={disabled || isGenerating}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void onSubmit();
          }
        }}
      />

      {showMentions && mentionOptions.length > 0 && (
        <div className={styles.mentionMenu} role="listbox">
          {mentionOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={styles.mentionItem}
              onClick={() => insertMention(opt.label)}
            >
              <Icon name={opt.id === 'assistant' ? 'ai-sparkle' : 'comment-alt'} />
              <span className={styles.mentionLabel}>{opt.label}</span>
              <span className={styles.mentionDesc}>{opt.description}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          {mentionsEnabled && (
            <button
              type="button"
              className={styles.atButton}
              onClick={() => {
                onChange(value ? `${value} @` : '@');
                setShowMentions(true);
                setMentionQuery('');
                textAreaRef.current?.focus();
              }}
              aria-label={t('dashboard-scene.comments-reply.insert-mention', 'Insert mention')}
            >
              <Icon name="at" size="md" />
            </button>
          )}
          {isGenerating && (
            <span className={styles.generating}>
              <Spinner inline size="sm" />
              {t('dashboard-scene.comments-assistant.generating', 'Assistant is replying…')}
            </span>
          )}
        </div>
        <span className={styles.kbdHint}>
          <Trans i18nKey="dashboard-scene.comments-thread.kbd-hint">⌘↵ post · Esc cancel</Trans>
        </span>
        <Button
          size="sm"
          variant="primary"
          onClick={() => void onSubmit()}
          disabled={!value.trim() || disabled || isGenerating}
        >
          {submitLabel ?? t('dashboard-scene.comments-thread.reply', 'Reply')}
        </Button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    position: 'relative',
  }),
  input: css({
    background: theme.colors.background.canvas,
    border: 'none',
    padding: 0,
    resize: 'none',
    '&:focus': {
      boxShadow: 'none',
      border: 'none',
    },
  }),
  mentionMenu: css({
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    marginBottom: theme.spacing(0.5),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    maxHeight: 160,
    overflowY: 'auto',
    zIndex: 1,
  }),
  mentionItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(0.75, 1),
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    color: theme.colors.text.primary,
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  mentionLabel: css({
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  mentionDesc: css({
    flex: 1,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  footer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  footerLeft: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  }),
  atButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    border: 'none',
    background: 'transparent',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    padding: 0,
  }),
  generating: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  kbdHint: css({
    flex: 1,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    textAlign: 'right',
  }),
});
