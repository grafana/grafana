import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { renderMarkdown, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, TabsBar, Tab, TabContent, useStyles2 } from '@grafana/ui';

import { type PulseBody, type PulseMention } from '../types';
import { bodyFromMarkdown, mentionMarkdownToken } from '../utils/body';
import {
  filterPanels,
  filterResourceSuggestions,
  type PanelSuggestion,
  type ResourceSuggestion,
  searchUsers,
  type UserSuggestion,
} from '../utils/lookups';

/**
 * ResourceMentionSource configures what the `#` picker offers when the
 * composer is mounted somewhere other than a dashboard. Dashboards keep
 * passing `panels` (panel ids are dashboard-local integers and don't
 * fit the UID-keyed shape); folder pages pass `{ kind: 'dashboard',
 * suggestions: [...] }` to offer their direct child dashboards.
 *
 * If both `panels` and `resourceMention` are provided, `resourceMention`
 * wins. The composer mounts each `#` token as a single mention kind per
 * composer instance — we don't ask the user to disambiguate between
 * "#panel" and "#dashboard" mid-type.
 */
export interface ResourceMentionSource {
  kind: 'dashboard' | 'folder';
  suggestions: ResourceSuggestion[];
}

interface Props {
  panels?: PanelSuggestion[];
  /** Opt-in resource-mention source. Overrides `panels` when present. */
  resourceMention?: ResourceMentionSource;
  placeholder?: string;
  /** Existing markdown source + already-known mentions when editing a pulse. */
  initialMarkdown?: string;
  initialMentions?: PulseMention[];
  /** Disables the submit button while the parent mutation is in flight. */
  pending?: boolean;
  /** Drop this user id from the @-mention suggestions (the current user). */
  currentUserId?: number;
  /** When true, render a required Title input above the textarea. Used
   *  for the parent pulse in a new thread so the thread row has a real
   *  summary instead of an auto-derived "first 80 chars of the body". */
  showTitle?: boolean;
  /** Seed the title input. Only meaningful when `showTitle` is true. */
  initialTitle?: string;
  /** Placeholder for the optional title input. */
  titlePlaceholder?: string;
  /** Submit accepts a body and (when `showTitle` is true) a non-empty
   *  title. Call sites that don't enable showTitle can ignore the second
   *  arg — TypeScript permits the narrower signature. */
  onSubmit: (body: PulseBody, title?: string) => void | Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}

type PickerKind = 'user' | 'resource';

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
  resourceMention,
  placeholder,
  initialMarkdown,
  initialMentions,
  pending,
  currentUserId,
  showTitle = false,
  initialTitle,
  titlePlaceholder,
  onSubmit,
  onCancel,
  autoFocus,
}: Props): ReactNode {
  const styles = useStyles2(getStyles);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<ActiveTab>('write');
  const [title, setTitle] = useState(initialTitle ?? '');
  const [text, setText] = useState(initialMarkdown ?? '');
  const [mentions, setMentions] = useState<PulseMention[]>(initialMentions ?? []);
  const [picker, setPicker] = useState<ActivePicker | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (autoFocus && tab === 'write') {
      // When the title field is visible focus that first so the caller
      // lands on the highest-level summary; otherwise jump straight to
      // the body textarea like a reply does.
      if (showTitle && titleInputRef.current) {
        titleInputRef.current.focus();
      } else {
        textareaRef.current?.focus();
      }
    }
  }, [autoFocus, tab, showTitle]);

  // User suggestions are fetched on debounce. AbortController cancels
  // an in-flight request when the query changes so the dropdown never
  // shows stale results. Lookup state is tri-modal (idle/loading/ready/
  // error) so the dropdown can surface "Searching…", "No matches", or
  // a real error message instead of silently disappearing — a 403 from
  // a missing org.users:read perm used to look identical to "no matches".
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [userLookupState, setUserLookupState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [userLookupError, setUserLookupError] = useState<string | null>(null);
  useEffect(() => {
    if (!picker || picker.kind !== 'user') {
      setUserSuggestions([]);
      setUserLookupState('idle');
      setUserLookupError(null);
      return;
    }
    if (picker.query.trim().length === 0) {
      // Empty query — match the underlying API behavior (returns nothing)
      // and treat the picker as idle so the dropdown does not flash a
      // "no matches" state while the user is still typing the first char.
      setUserSuggestions([]);
      setUserLookupState('idle');
      setUserLookupError(null);
      return;
    }
    const controller = new AbortController();
    setUserLookupState('loading');
    setUserLookupError(null);
    const handle = window.setTimeout(() => {
      searchUsers(picker.query, { signal: controller.signal, excludeUserId: currentUserId })
        .then((users) => {
          if (controller.signal.aborted) {
            return;
          }
          setUserSuggestions(users);
          setUserLookupState('ready');
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          setUserSuggestions([]);
          setUserLookupState('error');
          const status =
            err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
          if (status === 403 || status === 401) {
            setUserLookupError(
              t(
                'pulse.composer.user-lookup-forbidden',
                'You do not have permission to look up users in this org (requires org.users:read).'
              )
            );
          } else {
            setUserLookupError(t('pulse.composer.user-lookup-error', 'Could not load user suggestions.'));
          }
        });
    }, 150);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [picker, currentUserId]);

  // resourceKind disambiguates what the `#` trigger means in this
  // composer instance: dashboards offer `#panel`, the folder page
  // offers `#dashboard`. We pick the resourceMention source first so
  // call sites can pass an empty list without falling back to panels.
  const resourceKind: 'panel' | 'dashboard' | 'folder' = resourceMention ? resourceMention.kind : 'panel';

  const resourceSuggestions: Array<{ label: string; sublabel?: string; mention: PulseMention }> = useMemo(() => {
    if (!picker || picker.kind !== 'resource') {
      return [];
    }
    if (resourceMention) {
      return filterResourceSuggestions(resourceMention.suggestions, picker.query).map((r) => ({
        label: r.title,
        sublabel: r.uid,
        mention: { kind: resourceMention.kind, targetId: r.uid, displayName: r.title },
      }));
    }
    return filterPanels(panels, picker.query).map((p) => ({
      label: p.title,
      sublabel: `#${p.id}`,
      mention: { kind: 'panel', targetId: String(p.id), displayName: p.title },
    }));
  }, [picker, panels, resourceMention]);

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
    return resourceSuggestions;
  }, [picker, userSuggestions, resourceSuggestions]);

  // Only the user picker has async/networked state — the panel picker
  // is filtered locally from props and goes empty silently. So status
  // messaging (loading / no matches / error) only applies to @user.
  const userPickerStatusMessage: string | null = useMemo(() => {
    if (!picker || picker.kind !== 'user' || picker.query.trim().length === 0) {
      return null;
    }
    if (userLookupState === 'loading') {
      return t('pulse.composer.user-lookup-loading', 'Searching users…');
    }
    if (userLookupState === 'error') {
      return userLookupError;
    }
    if (userLookupState === 'ready' && userSuggestions.length === 0) {
      return t('pulse.composer.user-lookup-empty', 'No matching users.');
    }
    return null;
  }, [picker, userLookupState, userLookupError, userSuggestions.length]);

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
            kind: ch === '@' ? 'user' : 'resource',
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

  const trimmedTitle = title.trim();
  const submitDisabled = pending || text.trim().length === 0 || (showTitle && trimmedTitle.length === 0);

  async function submit() {
    if (text.trim().length === 0) {
      return;
    }
    if (showTitle && trimmedTitle.length === 0) {
      // The submit button is already disabled in this state; this guard
      // catches the keyboard shortcut path (Cmd/Ctrl+Enter) so a thread
      // is never created with an empty user-supplied title.
      return;
    }
    // Garbage-collect mentions whose token is no longer in the source
    // (the user may have backspaced over an inserted chip). The body
    // backend extracts mentions from the AST, so dropping unused ones
    // here keeps notifications honest.
    const liveMentions = mentions.filter((m) => text.includes(mentionMarkdownToken(m)));
    try {
      await onSubmit(bodyFromMarkdown(text, liveMentions), showTitle ? trimmedTitle : undefined);
      setSubmitError(null);
      setTitle('');
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
            {showTitle && (
              <input
                ref={titleInputRef}
                className={styles.title}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  titlePlaceholder ??
                  t('pulse.composer.title-placeholder', 'Title — a short summary of this thread')
                }
                aria-label={t('pulse.composer.title-aria', 'Thread title')}
                maxLength={160}
              />
            )}
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
            {picker && (suggestions.length > 0 || userPickerStatusMessage !== null) && (
              <ul className={styles.suggest} role="listbox">
                {suggestions.length > 0
                  ? suggestions.map((s, i) => (
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
                    ))
                  : userPickerStatusMessage && (
                      <li className={styles.suggestStatus} role="option" aria-selected={false} aria-disabled>
                        <span className={userLookupState === 'error' ? styles.error : styles.sublabel}>
                          {userPickerStatusMessage}
                        </span>
                      </li>
                    )}
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
        <span className={styles.hint}>{composerHint(resourceKind)}</span>
        <div className={styles.actionButtons}>
          {onCancel && (
            <Button size="sm" variant="destructive" onClick={onCancel} disabled={pending}>
              {t('pulse.composer.cancel', 'Cancel')}
            </Button>
          )}
          <Button size="sm" onClick={submit} disabled={submitDisabled}>
            {t('pulse.composer.send', 'Submit')}
          </Button>
        </div>
      </div>
      {submitError && <span className={styles.error}>{submitError}</span>}
    </div>
  );
}

/**
 * composerHint renders the footer hint text so the `#` example reflects
 * the active resource-mention kind. The dashboard drawer keeps showing
 * `#panel`; the folder page surfaces `#dashboard`. Other future
 * surfaces (e.g. an org-level composer) can extend the switch.
 */
function composerHint(kind: 'panel' | 'dashboard' | 'folder'): string {
  switch (kind) {
    case 'dashboard':
      return t('pulse.composer.hint-markdown-dashboard', 'Cmd/Ctrl+Enter to send · @user · #dashboard · **markdown**');
    case 'folder':
      return t('pulse.composer.hint-markdown-folder', 'Cmd/Ctrl+Enter to send · @user · #folder · **markdown**');
    case 'panel':
    default:
      return t('pulse.composer.hint-markdown', 'Cmd/Ctrl+Enter to send · @user · #panel · **markdown**');
  }
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
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  title: css({
    width: '100%',
    padding: theme.spacing(1),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    '&:focus': {
      outline: 'none',
      borderColor: theme.colors.primary.border,
    },
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
  suggestStatus: css({
    padding: theme.spacing(1),
    cursor: 'default',
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'baseline',
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
