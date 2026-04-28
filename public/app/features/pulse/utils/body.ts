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
  return !tokens.some(
    (t) => (t.kind === 'text' && t.text.trim().length > 0) || t.kind === 'mention'
  );
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
      out.push('@' + (n.mention.displayName ?? n.mention.targetId));
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
