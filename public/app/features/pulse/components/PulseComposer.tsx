import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { renderMarkdown, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, TabsBar, Tab, TabContent, useStyles2 } from '@grafana/ui';

import { ASSISTANT_MENTION_TARGET, type PulseBody, type PulseMention } from '../types';
import { bodyFromMarkdown, buildTimeMentionTarget, mentionMarkdownToken } from '../utils/body';
import {
  filterPanels,
  filterResourceSuggestions,
  type HookSuggestion,
  type PanelSuggestion,
  type ResourceSuggestion,
  searchHooks,
  searchUsers,
  type UserSuggestion,
} from '../utils/lookups';

/** Cap webhook rows in the shared @-picker so a long hook list can't
 *  crowd out user suggestions. Backend clamps the same value. */
const MAX_HOOK_SUGGESTIONS = 5;

/**
 * ResourceMentionSource configures one entry in the `#` picker. The
 * shape stays an object (kind + suggestions) — instead of a flat
 * dashboard list — because we plan to add other foldable resource
 * kinds (alerts, etc.) and the kind tag is what lets the suggestion
 * row attribute its origin in the merged dropdown.
 *
 * Dashboards still pass `panels` (panel ids are dashboard-local
 * integers, not UIDs) plus optional `resourceMentions` to mix in
 * sibling dashboards. Folder pages pass `resourceMentions=[{ kind:
 * 'dashboard', suggestions: [...] }]` to offer the dashboards in the
 * folder hierarchy. The singular `resourceMention` prop is preserved
 * as a back-compat alias and is treated as a one-element plural list.
 */
export interface ResourceMentionSource {
  kind: 'dashboard';
  suggestions: ResourceSuggestion[];
}

/**
 * CurrentTimeRange is the dashboard's live time window, surfaced to
 * the composer so typing `@now` / `@time` inserts a chip pre-filled
 * with that window. The chip freezes the range at insert time — no
 * relative-time evaluation later — so a comment about a 1h window
 * stays pinned to the exact period the author was looking at.
 *
 * `label` is the human-readable description (e.g. "Last 1 hour",
 * "2026-05-21 14:00 – 15:00"); callers typically pass the output
 * of `describeTimeRange` from `@grafana/data`.
 */
export interface CurrentTimeRange {
  from: number;
  to: number;
  label: string;
}

interface Props {
  panels?: PanelSuggestion[];
  /** Opt-in resource-mention source (singular). Convenience wrapper
   *  around a one-element `resourceMentions` array — kept so existing
   *  call sites don't have to refactor when they only offer one kind. */
  resourceMention?: ResourceMentionSource;
  /** Stack multiple resource sources behind the same `#` trigger.
   *  When both `resourceMention` and `resourceMentions` are passed
   *  the singular value is appended onto the plural list so the
   *  back-compat alias and the new prop can safely co-exist. */
  resourceMentions?: ResourceMentionSource[];
  placeholder?: string;
  /** Existing markdown source + already-known mentions when editing a pulse. */
  initialMarkdown?: string;
  initialMentions?: PulseMention[];
  /** Disables the submit button while the parent mutation is in flight. */
  pending?: boolean;
  /** Drop this user id from the @-mention suggestions (the current user). */
  currentUserId?: number;
  /** Dashboard's current time range. When set, typing `@now` or `@time`
   *  produces a one-row picker that inserts a time chip pinning the
   *  pulse to that window. Omit on surfaces with no live time context
   *  (e.g. the global Pulse overview) — the trigger then no-ops. */
  currentTimeRange?: CurrentTimeRange;
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
  resourceMentions,
  placeholder,
  initialMarkdown,
  initialMentions,
  pending,
  currentUserId,
  currentTimeRange,
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
  // a real error message instead of silently disappearing — the
  // Pulse-scoped /api/pulse/users/search endpoint should be reachable
  // for any signed-in Pulse user, but a misconfigured custom role
  // could still produce a 403 and we want to surface that loudly.
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
    // An empty query (bare `@`) lists the first page of org members so
    // people are immediately discoverable — same cadence as the hook
    // picker, which also lists on a bare `@`.
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
          const status = readErrorStatus(err);
          if (status === 403 || status === 401) {
            setUserLookupError(
              t(
                'pulse.composer.user-lookup-forbidden',
                'You do not have permission to look up users for mentions (requires pulse:read).'
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

  // Webhook (named hook) suggestions share the `@` trigger and ride
  // alongside users in the picker. They're fetched on the same debounce
  // cadence but tracked separately so a hook lookup failure (or an org
  // with zero hooks) never blocks user suggestions — the picker simply
  // shows whatever set resolved. Unlike users, an empty query still
  // lists hooks: there are few of them and surfacing them on a bare `@`
  // aids discovery of the automations available on this surface.
  const [hookSuggestions, setHookSuggestions] = useState<HookSuggestion[]>([]);
  useEffect(() => {
    if (!picker || picker.kind !== 'user') {
      setHookSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      searchHooks(picker.query, { signal: controller.signal, limit: MAX_HOOK_SUGGESTIONS })
        .then((hooks) => {
          if (controller.signal.aborted) {
            return;
          }
          setHookSuggestions(hooks);
        })
        .catch(() => {
          if (controller.signal.aborted) {
            return;
          }
          // Hooks are additive; a failed lookup degrades to "no hooks"
          // rather than surfacing an error in the shared picker.
          setHookSuggestions([]);
        });
    }, 150);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [picker]);

  // activeResourceKinds is the deduplicated set of mention kinds the
  // `#` trigger can produce on this composer instance. We derive it
  // up-front so the hint text and the (future) suggestion grouping
  // both see the same source of truth and so a call site that mixes
  // `panels` + `resourceMentions` is reflected in the footer hint
  // without a separate prop. Order is stable (panel → dashboard) so
  // two composer mounts with the same inputs render the same hint.
  const activeResourceKinds = useMemo<Array<'panel' | 'dashboard'>>(() => {
    const kinds = new Set<'panel' | 'dashboard'>();
    if (panels.length > 0) {
      kinds.add('panel');
    }
    if (resourceMention) {
      kinds.add(resourceMention.kind);
    }
    for (const src of resourceMentions ?? []) {
      kinds.add(src.kind);
    }
    // Empty composer surface (no sources at all): we still need a
    // sensible fallback for the hint copy. Panel is the historical
    // default because the dashboard drawer was the original composer
    // surface.
    if (kinds.size === 0) {
      kinds.add('panel');
    }
    const order: Array<'panel' | 'dashboard'> = ['panel', 'dashboard'];
    return order.filter((k) => kinds.has(k));
  }, [panels.length, resourceMention, resourceMentions]);

  const resourceSuggestions: Array<{ label: string; sublabel?: string; mention: PulseMention }> = useMemo(() => {
    if (!picker || picker.kind !== 'resource') {
      return [];
    }
    const out: Array<{ label: string; sublabel?: string; mention: PulseMention }> = [];
    // Panels render first because the dashboard drawer is the heaviest
    // user of `#`; pushing siblings/folders below keeps the muscle
    // memory of "first hit is usually a panel here" intact on the
    // surface where it matters most. Each branch caps its slice via
    // filterPanels / filterResourceSuggestions so a 500-dashboard
    // folder can't drown out a 50-panel dashboard.
    if (panels.length > 0) {
      for (const p of filterPanels(panels, picker.query)) {
        out.push({
          label: p.title,
          sublabel: `#${p.id}`,
          mention: { kind: 'panel', targetId: String(p.id), displayName: p.title },
        });
      }
    }
    // Build the flattened source list. The singular `resourceMention`
    // is appended onto whatever `resourceMentions` already has so the
    // back-compat alias and the new prop combine cleanly when both
    // are passed (the dashboard drawer's main use case).
    const sources: ResourceMentionSource[] = [];
    if (resourceMentions) {
      sources.push(...resourceMentions);
    }
    if (resourceMention) {
      sources.push(resourceMention);
    }
    for (const src of sources) {
      for (const r of filterResourceSuggestions(src.suggestions, picker.query)) {
        out.push({
          label: r.title,
          sublabel: `#${src.kind} · ${r.uid}`,
          mention: { kind: src.kind, targetId: r.uid, displayName: r.title },
        });
      }
    }
    return out;
  }, [picker, panels, resourceMention, resourceMentions]);

  // timeSuggestion is the synthetic top-row that the `@` picker renders
  // when the query starts with `now` or `time`. Both keywords map to the
  // same chip — discoverability for `@time`, muscle-memory for `@now`.
  // The chip freezes the dashboard's current range at insert time so a
  // later picker shift doesn't quietly mutate the comment's anchor.
  const timeSuggestion: { label: string; sublabel?: string; mention: PulseMention } | null = useMemo(() => {
    if (!picker || picker.kind !== 'user' || !currentTimeRange) {
      return null;
    }
    const q = picker.query.toLowerCase();
    // Require at least one character so a bare `@` (about to become
    // `@alice`) doesn't surface the time row — it would otherwise
    // become the default Enter target on every fresh mention.
    if (q.length === 0 || !('now'.startsWith(q) || 'time'.startsWith(q))) {
      return null;
    }
    return {
      label: t('pulse.composer.time-suggestion-label', 'Insert dashboard time range'),
      sublabel: currentTimeRange.label,
      mention: {
        kind: 'time',
        targetId: buildTimeMentionTarget(currentTimeRange.from, currentTimeRange.to),
        displayName: currentTimeRange.label,
      },
    };
  }, [picker, currentTimeRange]);

  // assistantSuggestion is the synthetic `@assistant` row, surfaced in the
  // `@` picker when the dashboardPulseAssistant toggle is on and the query
  // is a prefix of "assistant". Selecting it inserts a chip that tags the
  // Grafana Assistant; the backend then posts a reply into the thread.
  // Like the time row it requires at least one character so a bare `@`
  // (about to become `@alice`) doesn't surface it as the default target.
  const assistantSuggestion: { label: string; sublabel?: string; mention: PulseMention } | null = useMemo(() => {
    if (!picker || picker.kind !== 'user' || !config.featureToggles.dashboardPulseAssistant) {
      return null;
    }
    const q = picker.query.toLowerCase();
    if (q.length === 0 || !'assistant'.startsWith(q)) {
      return null;
    }
    return {
      label: t('pulse.composer.assistant-suggestion-label', 'Grafana Assistant'),
      sublabel: t('pulse.composer.assistant-suggestion-sublabel', 'Tag the assistant to reply in this thread'),
      mention: {
        kind: 'assistant',
        targetId: ASSISTANT_MENTION_TARGET,
        displayName: t('pulse.composer.assistant-display-name', 'Grafana Assistant'),
      },
    };
  }, [picker]);

  const suggestions: Array<{ label: string; sublabel?: string; mention: PulseMention }> = useMemo(() => {
    if (!picker) {
      return [];
    }
    if (picker.kind === 'user') {
      const userRows = userSuggestions.map((u) => ({
        label: u.name || u.login,
        sublabel: u.login,
        mention: { kind: 'user' as const, targetId: String(u.id), displayName: u.name || u.login },
      }));
      // Webhook rows render after users so people stay the primary hit
      // on the `@` trigger; the sublabel tags them as automations so a
      // reader can tell a hook apart from a same-named person.
      const hookRows = hookSuggestions.map((h) => ({
        label: h.name,
        sublabel: t('pulse.composer.hook-suggestion-sublabel', 'webhook'),
        mention: { kind: 'webhook' as const, targetId: h.uid, displayName: h.name },
      }));
      // Synthetic rows (time, assistant) sit at the top of the user-picker
      // dropdown so the arrow-key default selection lands on them when the
      // query matches their keyword, matching the user's expectation that
      // hitting Enter after typing `@now` or `@assistant` inserts that chip.
      // Their queries are disjoint (`now`/`time` vs `assistant`), so at most
      // one is ever non-null at a time.
      const synthetic = [timeSuggestion, assistantSuggestion].filter(
        (s): s is { label: string; sublabel?: string; mention: PulseMention } => s !== null
      );
      return [...synthetic, ...userRows, ...hookRows];
    }
    return resourceSuggestions;
  }, [picker, userSuggestions, hookSuggestions, resourceSuggestions, timeSuggestion, assistantSuggestion]);

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
                  titlePlaceholder ?? t('pulse.composer.title-placeholder', 'Title — a short summary of this thread')
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
                        {s.sublabel &&
                          (s.mention.kind === 'webhook' ? (
                            <em className={styles.sublabelHook}>({s.sublabel})</em>
                          ) : (
                            <span className={styles.sublabel}>{s.sublabel}</span>
                          ))}
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
        <span className={styles.hint}>{composerHint(activeResourceKinds)}</span>
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
 * composerHint renders the footer hint text so the `#` example
 * reflects the kinds the composer currently surfaces. Single-source
 * surfaces keep their existing hint copy so the strings stay
 * translated. Mixed surfaces (the dashboard drawer surfacing both
 * `#panel` and `#dashboard`) get a generic "#resource" hint —
 * listing every kind inline would balloon the footer and force
 * per-permutation translation strings.
 */
/**
 * readErrorStatus narrows the `unknown` thrown out of getBackendSrv
 * (and `searchUsers`) into a status code without a type assertion.
 * BackendSrvRequest errors expose `status` as a number; any other
 * shape yields undefined so the caller falls through to the generic
 * "Could not load" message instead of crashing.
 */
function readErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object' || !('status' in err)) {
    return undefined;
  }
  const { status } = err;
  return typeof status === 'number' ? status : undefined;
}

function composerHint(kinds: Array<'panel' | 'dashboard'>): string {
  if (kinds.length === 1) {
    switch (kinds[0]) {
      case 'dashboard':
        return t(
          'pulse.composer.hint-markdown-dashboard',
          'Cmd/Ctrl+Enter to send · @user · #dashboard · **markdown**'
        );
      case 'panel':
      default:
        return t('pulse.composer.hint-markdown', 'Cmd/Ctrl+Enter to send · @user · #panel · **markdown**');
    }
  }
  return t('pulse.composer.hint-markdown-multi', 'Cmd/Ctrl+Enter to send · @user · #resource · **markdown**');
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
  sublabelHook: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontStyle: 'italic',
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
