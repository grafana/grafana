export function withFocusedPanel(fn: (panelId: number) => void) {
  return () => {
    const elements = document.querySelectorAll(':hover');

    for (let i = elements.length - 1; i > 0; i--) {
      const element = (elements[i] as unknown) as HTMLElement;
      if (element.dataset?.panelid) {
        fn(parseInt(element.dataset?.panelid, 10));
      }
    }
  };
}
