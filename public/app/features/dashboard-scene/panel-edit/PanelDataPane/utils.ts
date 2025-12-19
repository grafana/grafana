export function scrollToQueryRow(refId: string) {
  // Query rows use uniqueId(refId + '_') for their internal id
  // The aria-controls attribute will be like "A_1" for refId "A"
  // So we need to search for aria-controls starting with "refId_"
  const queryRowHeader = document.querySelector(`[aria-controls^="${refId}_"]`);

  if (queryRowHeader) {
    // Find the parent query row wrapper
    const queryRow = queryRowHeader.closest('[data-testid="query-editor-row"]');

    if (queryRow instanceof HTMLElement) {
      queryRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

/**
 * Waits for a query row element to appear in the DOM, then scrolls to it.
 * Uses MutationObserver for reliable detection instead of setTimeout.
 *
 * @param refId - The refId of the query row to scroll to
 * @param timeoutMs - Maximum time to wait before giving up (default: 5000ms)
 */
export function scrollToQueryRowWhenReady(refId: string, timeoutMs = 5000): void {
  // First check if the element already exists
  const existingElement = document.querySelector(`[aria-controls^="${refId}_"]`);
  if (existingElement) {
    scrollToQueryRow(refId);
    return;
  }

  // Use MutationObserver to watch for the element to appear
  const observer = new MutationObserver((_mutations, obs) => {
    const queryRowHeader = document.querySelector(`[aria-controls^="${refId}_"]`);
    if (queryRowHeader) {
      obs.disconnect();
      scrollToQueryRow(refId);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Safety timeout to prevent indefinite observation
  setTimeout(() => observer.disconnect(), timeoutMs);
}
