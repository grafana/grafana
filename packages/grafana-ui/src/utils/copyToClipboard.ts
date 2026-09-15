type Ref = React.RefObject<HTMLElement | null>;

/**
 * Copies text to the clipboard using the Clipboard API or a fallback method.
 *
 * @param text The text to copy to the clipboard.
 * @param appendTo An optional ref used by the fallback method when the Clipboard API is not available.
 * @returns A promise that resolves when the copy operation completes.
 */
export function copyTextToClipboard(text: string, appendTo?: Ref): Promise<void> {
  if (!navigator.clipboard || !window.isSecureContext) {
    copyTextToClipboardFallback(text, appendTo);
    return Promise.resolve();
  }

  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard.write) {
    return navigator.clipboard.writeText(text);
  }

  const type = 'text/plain';
  const clipboardItem = new ClipboardItem({ [type]: Promise.resolve(text) });
  return navigator.clipboard.write([clipboardItem]);
}

function copyTextToClipboardFallback(text: string, appendTo?: Ref) {
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
}
