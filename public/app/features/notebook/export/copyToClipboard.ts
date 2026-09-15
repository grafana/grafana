import { copyStringToClipboard } from 'app/core/utils/explore';

/**
 * Copies text that is not known yet.
 *
 * A clipboard write issued after an `await` is refused outright by Safari, and by any browser whose
 * transient user activation has lapsed — a real risk on a list row, where the notebook is fetched
 * over the network before there is anything to copy. Handing `ClipboardItem` the still-pending
 * promise starts the write inside the click and lets the text arrive late; this is the same
 * workaround as createShortLinkClipboardItem in app/core/utils/shortLinks.
 *
 * Rejects when the copy fails, so a caller reports what happened rather than assuming it worked.
 */
export async function copyToClipboard(text: Promise<string>): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })]);
      return;
    }

    // Without ClipboardItem the write cannot begin before the text resolves, so it stays subject to
    // the activation window. Awaiting writeText is still worth doing: copyStringToClipboard drops the
    // promise it returns, which makes a rejection invisible.
    await navigator.clipboard.writeText(await text);
    return;
  }

  // Plain-http Grafana, where only document.execCommand is available. The shared helper discards
  // execCommand's result, so this is the one path that cannot tell success from failure. Reporting it
  // honestly means teaching copyStringToClipboard to return a result, which changes its other callers.
  copyStringToClipboard(await text);
}
