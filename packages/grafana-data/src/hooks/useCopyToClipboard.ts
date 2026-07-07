import { type RefObject, useCallback } from 'react';

/**
 * Copy text to the clipboard. Uses the modern Clipboard API in secure contexts and falls back
 * to a hidden `<textarea>` + `document.execCommand('copy')` otherwise.
 *
 * If `fallbackRef` is provided, the fallback textarea is appended to that element rather than
 * `document.body` — useful when copying from inside a focus-managed region (e.g. react-aria's
 * `FocusScope`) where elements outside the managed subtree can't receive focus.
 */
export function useCopyToClipboard(fallbackRef?: RefObject<HTMLElement | null>): (text: string) => Promise<void> {
  return useCallback(
    async (text: string) => {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
      }

      const textarea = document.createElement('textarea');
      const parent = fallbackRef?.current ?? document.body;
      parent.appendChild(textarea);
      textarea.value = text;
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    },
    [fallbackRef]
  );
}
