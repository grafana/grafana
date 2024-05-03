export function withFocusedPanel(fn: (panelId: number) => void) {
  return () => {
    const focusedElement = document.querySelector('[data-attention="true"]');

    if (focusedElement instanceof HTMLElement && focusedElement.dataset?.panelid) {
      fn(parseInt(focusedElement.dataset?.panelid, 10));
      return;
    }
  };
}
