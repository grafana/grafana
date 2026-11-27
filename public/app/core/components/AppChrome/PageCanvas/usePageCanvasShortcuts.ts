import { useEffect } from 'react';

import { selectPageCanvasTab } from './navigation';
import { type PageCanvasModel } from './types';

function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]') !==
      null
  );
}

/**
 * While a canvas shows: Alt+W closes the active tab, Alt+Shift+T reopens the last closed one and Alt+C closes the
 * canvas. Alt, because browsers keep Cmd/Ctrl+W and Cmd/Ctrl+Shift+T; text fields keep the keys for typing.
 */
export function usePageCanvasShortcuts(canvas: PageCanvasModel | null) {
  useEffect(() => {
    if (!canvas) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.defaultPrevented) {
        return;
      }
      if (isTextEntry(event.target)) {
        return;
      }
      if (event.code === 'KeyW' && !event.shiftKey) {
        const active = canvas.tabs.find((tab) => tab.id === canvas.activeTabId);
        if (active?.closable) {
          event.preventDefault();
          canvas.onClose([active.id]);
        }
      } else if (event.code === 'KeyT' && event.shiftKey) {
        const [lastClosed] = canvas.closedTabs;
        if (lastClosed) {
          event.preventDefault();
          selectPageCanvasTab(canvas, lastClosed);
        }
      } else if (event.code === 'KeyC' && !event.shiftKey) {
        event.preventDefault();
        canvas.onCloseCanvas();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [canvas]);
}
