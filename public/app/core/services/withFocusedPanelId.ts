export function withFocusedPanel(fn: (panelId: number) => void) {
  return () => {
    const elements = document.querySelectorAll(':hover');

    // Handle keyboard focus first
    const focusedGridElement = document.activeElement?.closest('[data-panelid]');

    if (focusedGridElement instanceof HTMLElement && focusedGridElement.dataset?.panelid) {
      fn(parseInt(focusedGridElement.dataset?.panelid, 10));
      return;
    }

    for (let i = elements.length - 1; i > 0; i--) {
      const element = elements[i];
      if (element instanceof HTMLElement && element.dataset?.panelid) {
        fn(parseInt(element.dataset?.panelid, 10));
      }
    }
  };
}
