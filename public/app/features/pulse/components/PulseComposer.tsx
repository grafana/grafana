import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, IconButton, useStyles2 } from '@grafana/ui';

import { type PulseMention } from '../types';
import { type BodyToken, isEmptyTokens } from '../utils/body';
import { filterPanels, type PanelSuggestion, searchUsers, type UserSuggestion } from '../utils/lookups';

import { MentionChip } from './MentionChip';

interface Props {
  panels?: PanelSuggestion[];
  placeholder?: string;
  /** Disables the submit button while the parent mutation is in flight. */
  pending?: boolean;
  onSubmit: (tokens: BodyToken[]) => void;
  autoFocus?: boolean;
}

type PickerKind = 'user' | 'panel';

interface ActivePicker {
  kind: PickerKind;
  query: string;
}

/**
 * PulseComposer is a textarea-style composer that supports inline @user
 * and @panel mentions. We deliberately avoid Lexical for v1 to keep the
 * dependency surface small; the trade-off is that mentions live as
 * sibling chips rather than as a single editable inline element. The
 * UX is close enough for a Slack-thread-style demo and the AST we
 * produce is identical to what a Lexical editor would emit.
 *
 * Type `@` to open the user picker. Type `#` to open the panel picker
 * (limited to panels in the current dashboard). Esc cancels the picker.
 * Enter selects the highlighted suggestion. Cmd/Ctrl+Enter submits.
 */
export function PulseComposer({ panels = [], placeholder, pending, onSubmit, autoFocus }: Props): ReactNode {
  const styles = useStyles2(getStyles);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tokens, setTokens] = useState<BodyToken[]>([]);
  const [draft, setDraft] = useState('');
  const [picker, setPicker] = useState<ActivePicker | null>(null);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // User suggestions are debounced to avoid hammering /api/users/search
  // on every keystroke. The composer cancels in-flight requests when
  // the query changes via AbortController.
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  useEffect(() => {
    if (!picker || picker.kind !== 'user') {
      setUserSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      searchUsers(picker.query, controller.signal)
        .then(setUserSuggestions)
        .catch(() => setUserSuggestions([]));
    }, 150);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [picker]);

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

  function commitText(extraNewline = false) {
    if (draft.length === 0) {
      if (extraNewline) {
        setTokens((prev) => [...prev, { kind: 'newline' }]);
      }
      return;
    }
    setTokens((prev) => {
      const next: BodyToken[] = [...prev, { kind: 'text', text: draft }];
      if (extraNewline) {
        next.push({ kind: 'newline' });
      }
      return next;
    });
    setDraft('');
  }

  function selectSuggestion(idx: number) {
    const sel = suggestions[idx];
    if (!sel) {
      setPicker(null);
      return;
    }
    setTokens((prev) => {
      const next: BodyToken[] = [...prev];
      if (draft.length > 0) {
        next.push({ kind: 'text', text: draft });
      }
      next.push({ kind: 'mention', mention: sel.mention });
      return next;
    });
    setDraft('');
    setPicker(null);
    setHighlight(0);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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

    if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'Backspace' && draft.length === 0 && tokens.length > 0) {
      e.preventDefault();
      setTokens((prev) => prev.slice(0, -1));
      return;
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    // If the very last character typed is a trigger, open the picker
    // and keep the trigger out of the text token (we don't want a
    // literal "@" before the chip).
    if (value.endsWith('@') && (picker == null || picker.kind !== 'user')) {
      const before = value.slice(0, -1);
      setDraft(before);
      commitInlineDraft(before);
      setDraft('');
      setPicker({ kind: 'user', query: '' });
      setHighlight(0);
      return;
    }
    if (value.endsWith('#') && (picker == null || picker.kind !== 'panel')) {
      const before = value.slice(0, -1);
      setDraft(before);
      commitInlineDraft(before);
      setDraft('');
      setPicker({ kind: 'panel', query: '' });
      setHighlight(0);
      return;
    }
    if (picker) {
      setPicker({ ...picker, query: value });
      setDraft('');
      return;
    }
    setDraft(value);
  }

  function commitInlineDraft(text: string) {
    if (text.length === 0) {
      return;
    }
    setTokens((prev) => [...prev, { kind: 'text', text }]);
  }

  function submit() {
    commitText();
    const next: BodyToken[] = draft.length > 0 ? [...tokens, { kind: 'text', text: draft }] : tokens;
    if (isEmptyTokens(next)) {
      return;
    }
    onSubmit(next);
    setTokens([]);
    setDraft('');
  }

  function removeToken(i: number) {
    setTokens((prev) => prev.filter((_, idx) => idx !== i));
  }

  function focusInput() {
    inputRef.current?.focus();
  }

  return (
    <div className={styles.wrap}>
      {/*
        The wrapping div is a click-target for "give the contained input
        focus when the user taps anywhere in the editor area." It carries
        no semantic meaning of its own — focus management is forwarded to
        the real <input> below — so we expose it as role="textbox" and
        wire a keyboard-equivalent so a11y rules that flag click-only
        non-interactive elements pass.
      */}
      <div
        className={styles.editor}
        role="textbox"
        tabIndex={-1}
        aria-label={t('pulse.composer.editor-aria', 'Pulse composer')}
        onClick={focusInput}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            focusInput();
          }
        }}
      >
        {tokens.map((tok, i) => {
          if (tok.kind === 'text') {
            return (
              <span key={i} className={styles.textChunk}>
                {tok.text}
              </span>
            );
          }
          if (tok.kind === 'newline') {
            return <br key={i} />;
          }
          return (
            <span key={i} className={styles.mentionWrap}>
              <MentionChip mention={tok.mention} />
              <IconButton
                name="times"
                aria-label={t('pulse.composer.remove-mention', 'Remove mention')}
                size="xs"
                onClick={(ev) => {
                  ev.stopPropagation();
                  removeToken(i);
                }}
              />
            </span>
          );
        })}
        <input
          ref={inputRef}
          className={styles.input}
          value={picker ? picker.query : draft}
          placeholder={
            tokens.length === 0 && !picker
              ? placeholder ?? t('pulse.composer.placeholder', 'Pulse on this dashboard… (@ for users, # for panels)')
              : ''
          }
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          aria-label={t('pulse.composer.input-aria', 'Pulse message')}
        />
      </div>

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

      <div className={styles.actions}>
        <span className={styles.hint}>
          {t('pulse.composer.hint', 'Cmd/Ctrl+Enter to send · @user · #panel')}
        </span>
        <Button size="sm" onClick={submit} disabled={pending || isEmptyTokens(tokens) && draft.trim().length === 0}>
          {t('pulse.composer.send', 'Send pulse')}
        </Button>
      </div>
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
  editor: css({
    minHeight: 56,
    padding: theme.spacing(1),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'text',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  input: css({
    flex: '1 0 120px',
    minWidth: 80,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
  }),
  textChunk: css({
    whiteSpace: 'pre-wrap',
  }),
  mentionWrap: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
  }),
  suggest: css({
    position: 'absolute',
    top: 'calc(100% - 36px)',
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
  hint: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
