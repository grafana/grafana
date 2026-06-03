import { type MentionKind, type PulseBody, type PulseBodyNode, type PulseMention } from '../types';

/**
 * isAtMention reports whether a mention kind is rendered/typed with an
 * `@` trigger (users, time anchors, the assistant) versus a `#` trigger
 * (panel / dashboard resource chips). Centralized so the markdown token,
 * the plain-text projection, and the composer all agree on the prefix.
 */
function isAtMention(kind: MentionKind): boolean {
  return kind === 'user' || kind === 'time' || kind === 'assistant';
}

/**
 * BodyToken is the intermediate representation our composer uses while
 * editing: the user types plain text and inserts mentions inline; we keep
 * the tokens flat and convert to/from the AST on the boundary.
 */
export type BodyToken =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; mention: PulseMention }
  | { kind: 'newline' };

/**
 * tokensToBody collapses a flat token list into a single-paragraph AST.
 * Newlines become paragraph breaks. The backend will accept this shape
 * (root → paragraph → text|mention|...).
 */
export function tokensToBody(tokens: BodyToken[]): PulseBody {
  const paragraphs: PulseBodyNode[] = [];
  let current: PulseBodyNode = { type: 'paragraph', children: [] };
  for (const tok of tokens) {
    if (tok.kind === 'newline') {
      paragraphs.push(current);
      current = { type: 'paragraph', children: [] };
      continue;
    }
    if (tok.kind === 'text') {
      if (tok.text.length === 0) {
        continue;
      }
      current.children!.push({ type: 'text', text: tok.text });
      continue;
    }
    if (tok.kind === 'mention') {
      current.children!.push({ type: 'mention', mention: tok.mention });
    }
  }
  if (current.children!.length > 0 || paragraphs.length === 0) {
    paragraphs.push(current);
  }
  return { root: { type: 'root', children: paragraphs } };
}

/**
 * isEmptyTokens returns true if no submittable content exists. Used to
 * disable the send button.
 */
export function isEmptyTokens(tokens: BodyToken[]): boolean {
  return !tokens.some((t) => (t.kind === 'text' && t.text.trim().length > 0) || t.kind === 'mention');
}

/**
 * bodyToText extracts a plain-text preview from an AST. Used in the
 * unread badge tooltip and as the fallback text in tests.
 */
export function bodyToText(body: PulseBody): string {
  const out: string[] = [];
  walk(body.root);
  return out.join('').replace(/\n+$/g, '');

  function walk(n: PulseBodyNode) {
    if (n.type === 'text') {
      out.push(n.text ?? '');
      return;
    }
    if (n.type === 'mention' && n.mention) {
      // Resource chips (panel / dashboard) read as `#name`; user, time,
      // and assistant chips share `@` because the author typed `@user`,
      // `@now` / `@time`, or `@assistant` to insert them.
      const prefix = isAtMention(n.mention.kind) ? '@' : '#';
      out.push(prefix + (n.mention.displayName ?? n.mention.targetId));
      return;
    }
    if (n.type === 'linebreak') {
      out.push('\n');
      return;
    }
    if (n.children) {
      for (const c of n.children) {
        walk(c);
      }
    }
    if (n.type === 'paragraph' || n.type === 'quote') {
      out.push('\n');
    }
  }
}

/**
 * isSafeUrl mirrors the backend's URL allowlist so the renderer can
 * defensively reject anything the server somehow accepted (defense in
 * depth). Returns the URL on success or undefined on rejection.
 */
export function isSafeUrl(raw: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return undefined;
  }
  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto') {
    return undefined;
  }
  return parsed.toString();
}

/**
 * mentionMarkdownToken returns the markdown source representation of a
 * mention. We wrap it in backticks so it renders as inline `<code>` —
 * visually distinct from prose without needing a custom React node, and
 * it matches the user's earlier ask for an inline-code mention style.
 *
 * `user`, `time`, and `assistant` chips use `@` (the trigger character
 * the author typed); resource chips (`panel`, `dashboard`) use `#`.
 */
export function mentionMarkdownToken(m: PulseMention): string {
  const prefix = isAtMention(m.kind) ? '@' : '#';
  const label = m.displayName ?? m.targetId;
  return '`' + prefix + label + '`';
}

/**
 * parseTimeMentionTarget splits a `time` mention's TargetID into its
 * epoch-ms `from` / `to` halves. Returns undefined for anything that
 * isn't two positive integers with from < to — defensive even though
 * the backend already enforces the shape, so a hand-edited or
 * pre-validation body never produces a chip with a malformed click
 * URL.
 */
export function parseTimeMentionTarget(targetId: string): { from: number; to: number } | undefined {
  const parts = targetId.split('|');
  if (parts.length !== 2) {
    return undefined;
  }
  const from = Number(parts[0]);
  const to = Number(parts[1]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0 || from >= to) {
    return undefined;
  }
  return { from, to };
}

/**
 * buildTimeMentionTarget is the inverse: produces a `<fromMs>|<toMs>`
 * TargetID from an explicit range so the composer doesn't reinvent
 * the encoding in two places.
 */
export function buildTimeMentionTarget(from: number, to: number): string {
  return `${Math.trunc(from)}|${Math.trunc(to)}`;
}

/**
 * timeChipHref builds the dashboard URL a `time` mention chip navigates
 * to: the source dashboard with `from` / `to` set to the chip's frozen
 * range. Caller is responsible for handing in a non-empty resourceUID;
 * we don't try to fabricate one because every surface that renders a
 * pulse already knows which resource the thread belongs to.
 */
export function timeChipHref(dashboardUID: string, from: number, to: number): string {
  return `/d/${encodeURIComponent(dashboardUID)}?from=${from}&to=${to}`;
}

/**
 * rewriteTimeMentionsInMarkdown swaps `` `@<label>` `` inline-code time
 * mention tokens for `` [`@<label>`](/d/<uid>?from=...&to=...) `` markdown
 * links so the rendered HTML produces a real navigable anchor — the
 * inline-code wrapper inside the link preserves the existing chip
 * styling. Without this rewrite, markdown-rendered time chips would be
 * inert (just styled <code>) like the existing panel/user chips, but
 * the *whole point* of a time chip is being able to click it to jump
 * the dashboard to that moment, so we hydrate it.
 *
 * Driven off the mention sidecar (not pattern-matched against raw
 * markdown) so a literal backticked `@now` typed by a user as prose
 * stays inert.
 */
export function rewriteTimeMentionsInMarkdown(
  markdown: string,
  mentions: readonly PulseMention[],
  dashboardUID: string
): string {
  if (!markdown || mentions.length === 0 || !dashboardUID) {
    return markdown;
  }
  let out = markdown;
  for (const m of mentions) {
    if (m.kind !== 'time') {
      continue;
    }
    const range = parseTimeMentionTarget(m.targetId);
    if (!range) {
      continue;
    }
    const label = m.displayName ?? m.targetId;
    const oldToken = '`@' + label + '`';
    const newToken = '[`@' + label + '`](' + timeChipHref(dashboardUID, range.from, range.to) + ')';
    // String#split/join sidesteps regex-escaping for labels containing
    // dots, parens, or other regex metacharacters — same approach as
    // rewritePanelMentionsInMarkdown.
    out = out.split(oldToken).join(newToken);
  }
  return out;
}

/**
 * rewritePanelMentionsInMarkdown swaps `` `#oldName` `` inline-code tokens
 * for the panel's current title. Panel ids are stable but titles aren't —
 * rename a panel after it's been mentioned and every existing chip would
 * otherwise read as the historical name forever, which is confusing
 * ("see #Latency" pointing at a panel now called "Tail latency").
 *
 * The mention sidecar in the AST is the source of truth for which
 * `<code>` spans were panel chips at compose time, so we drive the
 * rewrite off it instead of pattern-matching arbitrary backticked
 * `#text` (which could be a literal hashtag, a Markdown header inside
 * code, etc).
 *
 * Falls back to the historical token when the panel has been deleted or
 * isn't on the current dashboard — better stale text than a broken
 * reference.
 */
export function rewritePanelMentionsInMarkdown(
  markdown: string,
  mentions: readonly PulseMention[],
  panelTitlesById: ReadonlyMap<number, string>
): string {
  if (!markdown || mentions.length === 0 || panelTitlesById.size === 0) {
    return markdown;
  }
  let out = markdown;
  for (const m of mentions) {
    if (m.kind !== 'panel') {
      continue;
    }
    const panelId = parseInt(m.targetId, 10);
    if (Number.isNaN(panelId)) {
      continue;
    }
    const current = panelTitlesById.get(panelId);
    if (!current || current === m.displayName) {
      continue;
    }
    const oldToken = '`#' + (m.displayName ?? m.targetId) + '`';
    const newToken = '`#' + current + '`';
    // String#replaceAll keeps us out of regex-escape territory — panel
    // titles can contain dots, parens, asterisks, and other characters
    // that would need escaping inside a RegExp.
    out = out.split(oldToken).join(newToken);
  }
  return out;
}

/**
 * bodyFromMarkdown wraps a markdown source plus its mention metadata
 * into the AST shape the backend expects. The AST stays the
 * source-of-truth for mention extraction (so notifications fan out
 * without re-parsing markdown server-side); the markdown string is the
 * source-of-truth for rendering.
 */
export function bodyFromMarkdown(text: string, mentions: PulseMention[]): PulseBody {
  const children: PulseBodyNode[] = [];
  // Always include at least one text node so the AST validator's
  // "non-empty body" check passes even if the user wrote only
  // mentions or only whitespace.
  if (text.trim().length > 0) {
    children.push({ type: 'text', text });
  }
  for (const m of mentions) {
    children.push({ type: 'mention', mention: m });
  }
  if (children.length === 0) {
    children.push({ type: 'text', text: text || ' ' });
  }
  return {
    root: {
      type: 'root',
      children: [{ type: 'paragraph', children }],
    },
    markdown: text,
  };
}

/**
 * bodyToMarkdown reconstructs an editable markdown source from a body.
 * If the body already has markdown, return that verbatim. Otherwise
 * synthesize one from the AST so the markdown composer can edit
 * pre-markdown pulses without losing content.
 */
export function bodyToMarkdown(body: PulseBody): { text: string; mentions: PulseMention[] } {
  if (body.markdown !== undefined && body.markdown !== null) {
    return { text: body.markdown, mentions: collectMentions(body) };
  }
  const out: string[] = [];
  const mentions: PulseMention[] = [];
  walk(body.root);
  return {
    text: out
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd(),
    mentions,
  };

  function walk(n: PulseBodyNode) {
    if (n.type === 'text') {
      out.push(n.text ?? '');
      return;
    }
    if (n.type === 'mention' && n.mention) {
      out.push(mentionMarkdownToken(n.mention));
      mentions.push(n.mention);
      return;
    }
    if (n.type === 'linebreak') {
      out.push('\n');
      return;
    }
    if (n.children) {
      for (const c of n.children) {
        walk(c);
      }
    }
    if (n.type === 'paragraph' || n.type === 'quote') {
      out.push('\n\n');
    }
  }
}

/**
 * collectMentions walks a body's AST and returns every mention node in
 * document order. Exported so renderers can drive panel-title rewrites
 * off the mention sidecar instead of pattern-matching markdown text.
 */
export function collectMentions(body: PulseBody): PulseMention[] {
  const out: PulseMention[] = [];
  walk(body.root);
  return out;

  function walk(n: PulseBodyNode) {
    if (n.type === 'mention' && n.mention) {
      out.push(n.mention);
    }
    n.children?.forEach(walk);
  }
}

/**
 * bodyToTokens converts the AST into editable composer tokens so a pulse can
 * be edited with the same mention-aware input used for creation/replies.
 */
export function bodyToTokens(body: PulseBody): BodyToken[] {
  const out: BodyToken[] = [];
  walk(body.root);
  return trimTrailingNewlines(out);

  function walk(n: PulseBodyNode) {
    if (n.type === 'text' && n.text) {
      out.push({ kind: 'text', text: n.text });
      return;
    }
    if (n.type === 'mention' && n.mention) {
      out.push({ kind: 'mention', mention: n.mention });
      return;
    }
    if (n.type === 'linebreak') {
      out.push({ kind: 'newline' });
      return;
    }
    if (n.children) {
      for (const c of n.children) {
        walk(c);
      }
    }
    if (n.type === 'paragraph' || n.type === 'quote') {
      out.push({ kind: 'newline' });
    }
  }
}

function trimTrailingNewlines(tokens: BodyToken[]): BodyToken[] {
  const next = [...tokens];
  while (next.length > 0 && next[next.length - 1].kind === 'newline') {
    next.pop();
  }
  return next;
}
