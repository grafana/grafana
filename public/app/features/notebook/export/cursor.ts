/**
 * Native protocol scheme handled by a locally installed Cursor app. The notebook text goes straight
 * to the OS protocol handler so it never reaches cursor.com — unlike the https://cursor.com/link web
 * redirector, which would carry the whole notebook in a query string and so into a third party's
 * request logs. There is deliberately no fallback to that redirector: if Cursor is not installed the
 * browser simply ignores the scheme, which is the better outcome for someone who could not act on
 * the link anyway.
 */
const CURSOR_PROMPT_URL = 'cursor://anysphere.cursor-deeplink/prompt';
const MAX_URL_LENGTH = 8000;
const TRUNCATION_NOTICE = '\n\n[Notebook truncated to fit the Cursor deep link limit]';

/** Builds the deep link, truncating the notebook if the url would exceed Cursor's limit. */
export function buildCursorPromptDeeplink(promptText: string): string {
  const full = buildUrl(promptText);

  return full.length <= MAX_URL_LENGTH ? full : buildTruncatedUrl(promptText);
}

export function openCursorPromptDeeplink(promptText: string, win: Window = window): void {
  // Called from a click, so this user-gesture navigation is allowed to invoke the protocol handler.
  // A handled scheme does not navigate the page away.
  win.location.href = buildCursorPromptDeeplink(promptText);
}

function buildUrl(text: string): string {
  const url = new URL(CURSOR_PROMPT_URL);
  url.searchParams.set('text', text);

  return url.toString();
}

/**
 * Binary search for the longest prefix that still fits. Cutting a fixed number of characters would
 * not work: url encoding means one character of markdown can cost several of url.
 *
 * Searched over characters rather than the string directly, because `slice` counts UTF-16 code units
 * and so can cut an emoji in half. Url serialization replaces the orphaned half with U+FFFD instead
 * of throwing, so the cost is only a mangled character at the cut — but the fix is one Array.from.
 */
function buildTruncatedUrl(text: string): string {
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (buildUrl(prefix(characters, mid)).length <= MAX_URL_LENGTH) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return buildUrl(prefix(characters, low));
}

function prefix(characters: string[], length: number): string {
  return characters.slice(0, length).join('') + TRUNCATION_NOTICE;
}
