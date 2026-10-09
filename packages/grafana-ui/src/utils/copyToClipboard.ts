import { type RefObject } from 'react';

type Ref = RefObject<HTMLElement | null>;

/**
 * Copy text to the clipboard. Uses the modern Clipboard API in secure contexts and falls back
 * to a hidden `<textarea>` + `document.execCommand('copy')` otherwise.
 *  If `appendTo` is provided, the fallback textarea is appended to that element rather than
 * `document.body`, useful when copying from inside a focus-managed region (e.g. react-aria's
 * `FocusScope`) where elements outside the managed subtree can't receive focus.
 *
 * @param text The text to copy, or a promise of it. A pending promise is passed on unresolved so the
 * write is issued inside the click's user activation — Safari refuses one made after an `await`.
 * @param appendTo An optional ref used by the fallback method when the Clipboard API is not available.
 * @returns A promise that rejects when the copy fails.
 */
export async function copyTextToClipboard(text: string | Promise<string>, appendTo?: Ref): Promise<void> {
  if (!navigator.clipboard || !window.isSecureContext) {
    copyTextToClipboardFallback(await text, appendTo);
    return;
  }

  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard.write) {
    await navigator.clipboard.writeText(await text);
    return;
  }

  const type = 'text/plain';
  // Promise.resolve is identity for a native promise, so a pending one stays pending here.
  const clipboardItem = new ClipboardItem({ [type]: Promise.resolve(text) });
  await navigator.clipboard.write([clipboardItem]);
}

function copyTextToClipboardFallback(text: string, appendTo?: Ref) {
  // select() moves focus into the textarea and removing it drops focus to <body>, so anything
  // watching blur (tooltips, menus) closes on copy. Put focus back where the caller had it.
  const previouslyFocused = document.activeElement;
  // Use a fallback method for browsers/contexts that don't support the Clipboard API.
  // See https://web.dev/async-clipboard/#feature-detection.
  // Use textarea so the user can copy multi-line content.
  const textarea = document.createElement('textarea');
  (appendTo?.current ?? document.body).appendChild(textarea);
  textarea.value = text;
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();

  if (previouslyFocused instanceof HTMLElement) {
    previouslyFocused.focus();
  }
}
