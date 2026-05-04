import { type PulseBody, type PulseBodyNode, type PulseMention } from '../types';

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
      const prefix = n.mention.kind === 'panel' ? '#' : '@';
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
 */
export function mentionMarkdownToken(m: PulseMention): string {
  const prefix = m.kind === 'panel' ? '#' : '@';
  const label = m.displayName ?? m.targetId;
  return '`' + prefix + label + '`';
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

function collectMentions(body: PulseBody): PulseMention[] {
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
