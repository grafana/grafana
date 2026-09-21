/**
 * Deep links that hand a prompt to a locally installed coding agent.
 *
 * Native protocol schemes only. The prompt goes straight to the OS protocol handler,
 * so it never reaches the vendor's servers - unlike the web redirectors some agents
 * also offer, which would carry the whole prompt in a query string and so into a
 * third party's request logs. There is deliberately no fallback to those: if the
 * agent is not installed the browser ignores the scheme, which is the better outcome
 * for someone who could not have acted on the link anyway.
 *
 * Lifted from the Notebooks export module (removed in #132568), whose comments
 * recorded the parts that are not obvious: the url-encoding cost of truncation, the
 * surrogate-pair hazard, and that a handler which mis-parses embedded urls decides
 * what a payload may contain.
 */

/** What an agent's prompt handler accepts. */
interface PromptHandler {
  /** Base url of the handler. */
  url: string;
  /** Query parameter carrying the prompt. */
  param: string;
  /** The documented ceiling. */
  limit: number;
  /**
   * Whether `limit` counts the whole url or only the prompt.
   *
   * Not a detail worth smoothing over: Cursor's is a url-length limit, so every
   * newline costs three characters against it, while Claude Code documents a
   * character limit on the prompt itself. Truncating to the wrong one either
   * overshoots or throws away text that would have fitted.
   */
  limitCounts: 'url' | 'prompt';
}

const HANDLERS = {
  cursor: {
    url: 'cursor://anysphere.cursor-deeplink/prompt',
    param: 'text',
    limit: 8000,
    limitCounts: 'url',
  },
  claude: {
    // The desktop app's own scheme, not the CLI's `claude-cli://open`.
    //
    // Both open a Claude Code session with the prompt typed in but not sent, behind the
    // app's "prompt from an external link" warning. The difference is what can be drawn:
    // `claude-cli://` opens a terminal, which renders no MCP App and falls back to the
    // text result, while the desktop app renders the panel - verified by hand, though
    // the support matrix does not list that surface. Handing a panel to the one place it
    // cannot be shown was the wrong default.
    url: 'claude://code/new',
    param: 'q',
    // Inherited from the documented `claude-cli://open` cap. A panel handoff is a few
    // hundred characters, so this only ever bounds a caller passing something larger.
    limit: 5000,
    limitCounts: 'prompt',
  },
} as const satisfies Record<string, PromptHandler>;

export type AgentId = keyof typeof HANDLERS;

const TRUNCATION_NOTICE = '\n\n[truncated to fit the deep link limit]';

function buildUrl(handler: PromptHandler, prompt: string): string {
  const url = new URL(handler.url);
  url.searchParams.set(handler.param, prompt);

  return url.toString();
}

function measure(handler: PromptHandler, prompt: string): number {
  return handler.limitCounts === 'url' ? buildUrl(handler, prompt).length : Array.from(prompt).length;
}

/**
 * Longest prefix of `prompt` that still fits, by binary search.
 *
 * Cutting a fixed number of characters would not work for a url limit, because one
 * character of prompt can cost several of url. Searched over characters rather than
 * the string, because `slice` counts UTF-16 code units and so can cut an emoji in
 * half; url serialization then replaces the orphaned half with U+FFFD rather than
 * throwing, so the symptom would be one mangled character at the cut.
 */
function truncateToFit(handler: PromptHandler, prompt: string): string {
  const characters = Array.from(prompt);
  const prefix = (length: number) => characters.slice(0, length).join('') + TRUNCATION_NOTICE;

  let low = 0;
  let high = characters.length;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (measure(handler, prefix(mid)) <= handler.limit) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return prefix(low);
}

/** Builds the deep link, truncating the prompt only if it would not otherwise fit. */
export function buildAgentPromptDeeplink(agent: AgentId, prompt: string): string {
  const handler = HANDLERS[agent];

  return measure(handler, prompt) <= handler.limit
    ? buildUrl(handler, prompt)
    : buildUrl(handler, truncateToFit(handler, prompt));
}

/**
 * Hands the prompt to the agent.
 *
 * Must be called from a click: a user gesture is what allows the navigation to
 * invoke a protocol handler. A handled scheme does not navigate the page away, and
 * an unhandled one is ignored with no error and no way to detect it - which is why
 * callers can only report that the handoff was attempted.
 */
export function openAgentPromptDeeplink(agent: AgentId, prompt: string, win: Window = window): void {
  win.location.href = buildAgentPromptDeeplink(agent, prompt);
}
