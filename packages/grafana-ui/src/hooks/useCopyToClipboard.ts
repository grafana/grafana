import { useCallback, type RefObject } from 'react';

import { copyTextToClipboard } from '../utils/copyToClipboard';

/**
 * Copy text to the clipboard. Uses the modern Clipboard API in secure contexts and falls back
 * to a hidden `<textarea>` + `document.execCommand('copy')` otherwise.
 *
 * If `appendTo` is provided, the fallback textarea is appended to that element rather than
 * `document.body`, useful when copying from inside a focus-managed region (e.g. react-aria's
 * `FocusScope`) where elements outside the managed subtree can't receive focus.
 * @param appendTo An optional ref used by the fallback method when the Clipboard API is not available.
 * @returns A callback that copies text to the clipboard and returns a promise that resolves when the
 * copy completes or rejects if the operation fails.
 */
export function useCopyToClipboard(appendTo?: RefObject<HTMLElement | null>) {
  return useCallback(
    async (text: string | Promise<string>) => {
      await copyTextToClipboard(text, appendTo);
    },
    [appendTo]
  );
}
