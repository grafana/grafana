import { type RefObject } from 'react';

type Ref = RefObject<HTMLElement | null>;

/**
 * Copies text to the clipboard using the Clipboard API or a fallback method.
 *
 * @param text The text to copy, or a promise of it. A pending promise is handed to the clipboard
 * unresolved on purpose, so the write is issued inside the click's user activation rather than after
 * the text arrives — Safari refuses a write made after an `await`, and any browser's transient
 * activation can lapse while text is fetched over the network.
 * @param appendTo An optional ref used by the fallback method when the Clipboard API is not available.
 * @returns A promise that rejects when the clipboard refuses the write, or when a promised text
 * fails to resolve, so a caller can report what happened.
 */
export async function copyTextToClipboard(text: string | Promise<string>, appendTo?: Ref): Promise<void> {
  if (!navigator.clipboard || !window.isSecureContext) {
    copyTextToClipboardFallback(await text, appendTo);
    return;
  }

  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard.write) {
    // Without ClipboardItem the write cannot begin before the text resolves, so it stays subject to
    // the activation window.
    await navigator.clipboard.writeText(await text);
    return;
  }

  const type = 'text/plain';
  // Promise.resolve is the identity function for a native promise, so a pending one is passed
  // through still pending.
  const clipboardItem = new ClipboardItem({ [type]: Promise.resolve(text) });
  await navigator.clipboard.write([clipboardItem]);
}

function copyTextToClipboardFallback(text: string, appendTo?: Ref) {
  // Use a fallback method for browsers/contexts that don't support the Clipboard API.
  // See https://web.dev/async-clipboard/#feature-detection.
  // Use textarea so the user can copy multi-line content.
  const textarea = document.createElement('textarea');
  // Appended to the ref when one is given: inside a react-aria focus manager nothing outside the
  // managed area can be focused, so a textarea on document.body could not be copied from.
  (appendTo?.current ?? document.body).appendChild(textarea);
  textarea.value = text;
  textarea.focus();
  textarea.select();
  // execCommand's result is discarded, so this is the one path that cannot tell success from
  // failure. Reporting it honestly would change what every copy button shows on plain-http Grafana.
  document.execCommand('copy');
  textarea.remove();
}
