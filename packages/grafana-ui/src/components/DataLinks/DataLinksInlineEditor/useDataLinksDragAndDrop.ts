import { createContext, useContext, useEffect, useState } from 'react';

type DragAndDropModule = typeof import('@hello-pangea/dnd');

const DataLinksDragAndDropContext = createContext<DragAndDropModule | undefined>(undefined);

export const DataLinksDragAndDropProvider = DataLinksDragAndDropContext.Provider;

let dragAndDropPromise: Promise<DragAndDropModule> | undefined;

export function useDataLinksDragAndDrop() {
  const [dragAndDrop, setDragAndDrop] = useState<DragAndDropModule>();

  useEffect(() => {
    let cancelled = false;

    dragAndDropPromise ??= import(/* webpackChunkName: "drag-and-drop" */ '@hello-pangea/dnd');
    dragAndDropPromise.then((module) => {
      if (!cancelled) {
        setDragAndDrop(module);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return dragAndDrop;
}

export function useDataLinksDragAndDropContext() {
  return useContext(DataLinksDragAndDropContext);
}
