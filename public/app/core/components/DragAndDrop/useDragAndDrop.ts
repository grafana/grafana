import { createContext, useContext, useEffect, useState } from 'react';

export type DragAndDropModule = typeof import('@hello-pangea/dnd');

const DragAndDropContext = createContext<DragAndDropModule | undefined>(undefined);

export const DragAndDropProvider = DragAndDropContext.Provider;

let dragAndDropPromise: Promise<DragAndDropModule> | undefined;

function loadDragAndDrop() {
  dragAndDropPromise ??= import(/* webpackChunkName: "drag-and-drop" */ '@hello-pangea/dnd');
  return dragAndDropPromise;
}

export function useDragAndDrop(enabled: boolean) {
  const [dragAndDrop, setDragAndDrop] = useState<DragAndDropModule>();

  useEffect(() => {
    if (!enabled) {
      setDragAndDrop(undefined);
      return;
    }

    let cancelled = false;

    loadDragAndDrop().then((module) => {
      if (!cancelled) {
        setDragAndDrop(module);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return dragAndDrop;
}

export function useDragAndDropContext() {
  return useContext(DragAndDropContext);
}
