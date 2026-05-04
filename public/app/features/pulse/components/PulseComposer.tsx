import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { renderMarkdown, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, TabsBar, Tab, TabContent, useStyles2 } from '@grafana/ui';

import { type PulseBody, type PulseMention } from '../types';
import { bodyFromMarkdown, mentionMarkdownToken } from '../utils/body';
import { filterPanels, type PanelSuggestion, searchUsers, type UserSuggestion } from '../utils/lookups';

interface Props {
  panels?: PanelSuggestion[];
  placeholder?: string;
  /** Existing markdown source + already-known mentions when editing a pulse. */
  initialMarkdown?: string;
  initialMentions?: PulseMention[];
  /** Disables the submit button while the parent mutation is in flight. */
  pending?: boolean;
  /** Drop this user id from the @-mention suggestions (the current user). */
  currentUserId?: number;
  onSubmit: (body: PulseBody) => void | Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}

type PickerKind = 'user' | 'panel';

interface ActivePicker {
  kind: PickerKind;
  /** Position in the textarea where the trigger character was typed. */
  triggerStart: number;
  query: string;
}

type ActiveTab = 'write' | 'preview';

/**
 * PulseComposer is a Slack-style markdown composer with a Write tab
 * (textarea + @/# mention picker) and a Preview tab (renders through
 * Grafana's renderMarkdown — same sanitizer the Text panel uses).
 *
 * Mentions are inserted as inline-code-wrapped tokens (e.g. `` `@alice` ``).
 * That keeps the markdown source human-readable, gives mentions a
 * visually distinct render in both the preview and the final pulse, and
 * still lets us track the mention metadata in a sidecar so the backend
 * can fan out notifications without re-parsing markdown server-side.
 */
export function PulseComposer({
  panels = [],
  placeholder,
  initialMarkdown,
  initialMentions,
  pending,
  currentUserId,
  onSubmit,
  onCancel,
  autoFocus,
}: Props): ReactNode {
  const styles = useStyles2(getStyles);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<ActiveTab>('write');
  const [text, setText] = useState(initialMarkdown ?? '');
  const [mentions, setMentions] = useState<PulseMention[]>(initialMentions ?? []);
  const [picker, setPicker] = useState<ActivePicker | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (autoFocus && tab === 'write') {
      textareaRef.current?.focus();
    }
  }, [autoFocus, tab]);

  // User suggestions are fetched on debounce. AbortController cancels
  // an in-flight request when the query changes so the dropdown never
  // shows stale results.
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  useEffect(() => {
    if (!picker || picker.kind !== 'user') {
      setUserSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      searchUsers(picker.query, { signal: controller.signal, excludeUserId: currentUserId })
        .then(setUserSuggestions)
        .catch(() => setUserSuggestions([]));
    }, 150);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [picker, currentUserId]);

  const panelSuggestions = useMemo(() => {
    if (!picker || picker.kind !== 'panel') {
      return [];
    }
    return filterPanels(panels, picker.query);
  }, [picker, panels]);

  const suggestions: Array<{ label: string; sublabel?: string; mention: PulseMention }> = useMemo(() => {
    if (!picker) {
      return [];
    }
    if (picker.kind === 'user') {
      return userSuggestions.map((u) => ({
        label: u.name || u.login,
        sublabel: u.login,
        mention: { kind: 'user', targetId: String(u.id), displayName: u.name || u.login },
      }));
    }
    return panelSuggestions.map((p) => ({
      label: p.title,
      sublabel: `#${p.id}`,
      mention: { kind: 'panel', targetId: String(p.id), displayName: p.title },
    }));
  }, [picker, userSuggestions, panelSuggestions]);

  function selectSuggestion(idx: number) {
    const sel = suggestions[idx];
    if (!sel || !picker) {
      setPicker(null);
      return;
    }
    const ta = textareaRef.current;
    const caret = ta?.selectionStart ?? text.length;
    const before = text.slice(0, picker.triggerStart);
    const after = text.slice(caret);
    const inserted = mentionMarkdownToken(sel.mention) + ' ';
    const next = before + inserted + after;
    setText(next);
    setMentions((prev) => {
      // Dedupe by (kind|targetId) so picking the same user twice
      // doesn't fan out duplicate notifications.
      const key = `${sel.mention.kind}|${sel.mention.targetId}`;
      if (prev.some((m) => `${m.kind}|${m.targetId}` === key)) {
        return prev;
      }
      return [...prev, sel.mention];
    });
    setPicker(null);
    setHighlight(0);
    // Restore focus + caret position to right after the inserted token.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) {
        return;
      }
      const caretAfter = before.length + inserted.length;
      el.focus();
      el.setSelectionRange(caretAfter, caretAfter);
    });
  }

  function onTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    const caret = e.target.selectionStart;
    setText(value);
    setSubmitError(null);
    updatePickerFromCaret(value, caret);
  }

  function updatePickerFromCaret(value: string, caret: number) {
    // Walk backwards from the caret to find the most recent unescaped
    // `@` or `#` on the same line. If we hit whitespace before the
    // trigger, no picker is active (mentions only work mid-word at
    // the start or after whitespace).
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === '\n') {
        setPicker(null);
        return;
      }
      if (ch === '@' || ch === '#') {
        const before = i > 0 ? value[i - 1] : '';
        // Only trigger when the @/# is at the start, after whitespace,
        // or after an opening punctuation — avoids hijacking emails
        // ("alice@example.com") or hashtags inside URLs.
        if (i === 0 || /\s|[(\[]/.test(before)) {
          const query = value.slice(i + 1, caret);
          if (/\s/.test(query)) {
            setPicker(null);
            return;
          }
          setPicker({
            kind: ch === '@' ? 'user' : 'panel',
            triggerStart: i,
            query,
          });
          setHighlight(0);
          return;
        }
        setPicker(null);
        return;
      }
      i--;
    }
    setPicker(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (picker && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectSuggestion(highlight);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setPicker(null);
        return;
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  async function submit() {
    if (text.trim().length === 0) {
      return;
    }
    // Garbage-collect mentions whose token is no longer in the source
    // (the user may have backspaced over an inserted chip). The body
    // backend extracts mentions from the AST, so dropping unused ones
    // here keeps notifications honest.
    const liveMentions = mentions.filter((m) => text.includes(mentionMarkdownToken(m)));
    try {
      await onSubmit(bodyFromMarkdown(text, liveMentions));
      setSubmitError(null);
      setText('');
      setMentions([]);
      setPicker(null);
      setTab('write');
    } catch {
      setSubmitError(
        t('pulse.composer.submit-error', 'Could not submit thread. Please check Pulse API and try again.')
      );
    }
  }

  const previewHtml = useMemo(() => {
    if (tab !== 'preview') {
      return '';
    }
    return renderMarkdown(text || '');
  }, [tab, text]);

  return (
    <div className={styles.wrap}>
      <TabsBar>
        <Tab
          label={t('pulse.composer.tab-write', 'Write')}
          active={tab === 'write'}
          onChangeTab={() => setTab('write')}
        />
        <Tab
          label={t('pulse.composer.tab-preview', 'Preview')}
          active={tab === 'preview'}
          onChangeTab={() => setTab('preview')}
        />
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {tab === 'write' ? (
          <div className={styles.editor}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={text}
              placeholder={
                placeholder ??
                t(
                  'pulse.composer.placeholder',
                  'Pulse on this dashboard… (@ for users, # for panels, **markdown** supported)'
                )
              }
              onChange={onTextChange}
              onKeyDown={onKeyDown}
              onSelect={(e) => updatePickerFromCaret(e.currentTarget.value, e.currentTarget.selectionStart)}
              aria-label={t('pulse.composer.input-aria', 'Pulse message')}
              rows={4}
            />
            {picker && suggestions.length > 0 && (
              <ul className={styles.suggest} role="listbox">
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.mention.kind}-${s.mention.targetId}`}
                    className={i === highlight ? styles.suggestActive : styles.suggestItem}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      selectSuggestion(i);
                    }}
                  >
                    <strong>{s.label}</strong>
                    {s.sublabel && <span className={styles.sublabel}>{s.sublabel}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className={styles.preview}>
            {text.trim().length > 0 ? (
              <div className={styles.previewBody} dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <span className={styles.previewEmpty}>
                {t('pulse.composer.preview-empty', 'Nothing to preview yet.')}
              </span>
            )}
          </div>
        )}
      </TabContent>

      <div className={styles.actions}>
        <span className={styles.hint}>
          {t('pulse.composer.hint-markdown', 'Cmd/Ctrl+Enter to send · @user · #panel · **markdown**')}
        </span>
        <div className={styles.actionButtons}>
          {onCancel && (
            <Button size="sm" variant="destructive" onClick={onCancel} disabled={pending}>
              {t('pulse.composer.cancel', 'Cancel')}
            </Button>
          )}
          <Button size="sm" onClick={submit} disabled={pending || text.trim().length === 0}>
            {t('pulse.composer.send', 'Submit')}
          </Button>
        </div>
      </div>
      {submitError && <span className={styles.error}>{submitError}</span>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  tabContent: css({
    padding: 0,
  }),
  editor: css({
    position: 'relative',
  }),
  textarea: css({
    width: '100%',
    minHeight: 96,
    padding: theme.spacing(1),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.body.fontSize,
    resize: 'vertical',
    '&:focus': {
      outline: 'none',
      borderColor: theme.colors.primary.border,
    },
  }),
  preview: css({
    minHeight: 96,
    padding: theme.spacing(1),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
  }),
  previewBody: css({
    '& p': { margin: '0 0 0.5em' },
    '& p:last-child': { marginBottom: 0 },
    '& code': {
      background: theme.colors.warning.transparent,
      color: theme.colors.warning.text,
      padding: '0 4px',
      borderRadius: theme.shape.radius.default,
      fontSize: theme.typography.bodySmall.fontSize,
    },
    '& pre': {
      background: theme.colors.background.canvas,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      overflowX: 'auto',
    },
    '& blockquote': {
      borderLeft: `3px solid ${theme.colors.border.medium}`,
      margin: '0 0 0.5em',
      padding: theme.spacing(0, 1),
      color: theme.colors.text.secondary,
    },
    '& ul, & ol': {
      margin: '0 0 0.5em',
      paddingLeft: theme.spacing(3),
    },
    '& a': {
      color: theme.colors.primary.text,
      textDecoration: 'underline',
    },
  }),
  previewEmpty: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  }),
  suggest: css({
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    zIndex: 10,
    maxHeight: 240,
    overflowY: 'auto',
    boxShadow: theme.shadows.z2,
  }),
  suggestItem: css({
    padding: theme.spacing(1),
    cursor: 'pointer',
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'baseline',
  }),
  suggestActive: css({
    padding: theme.spacing(1),
    cursor: 'pointer',
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'baseline',
    background: theme.colors.background.canvas,
  }),
  sublabel: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  actions: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
  actionButtons: css({
    display: 'inline-flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
  hint: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  error: css({
    color: theme.colors.error.text,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
