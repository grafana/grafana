export function withFocusedPanel(fn: (panelId: number) => void) {
  return () => {
    const elementFocus = document.querySelector<HTMLInputElement>(':focus-visible.react-grid-item');
    const elementHover = document.querySelector<HTMLInputElement>(':hover.react-grid-item');

    if (elementFocus && elementFocus.dataset.panelid) {
      fn(parseInt(elementFocus.dataset.panelid, 10));
      return;
    }
    if (elementHover && elementHover.dataset.panelid) {
      fn(parseInt(elementHover.dataset.panelid, 10));
      return;
    }
  };
}
