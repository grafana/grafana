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
