import {
  type DraggableProvided,
  type DraggableRubric,
  type DraggableStateSnapshot,
  type DragDropContextProps,
  type DraggableProps,
  type DroppableProps,
  type DroppableProvided,
  type DroppableStateSnapshot,
} from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';

export type DragAndDropModule = typeof import('@hello-pangea/dnd');

/** The subset of `@hello-pangea/dnd` components consumers use through `useDragAndDrop`. */
export interface DragAndDropComponents {
  DragDropContext: DragAndDropModule['DragDropContext'];
  Droppable: DragAndDropModule['Droppable'];
  Draggable: DragAndDropModule['Draggable'];
}

const noopRef = () => {};

const droppableProvided: DroppableProvided = {
  innerRef: noopRef,
  droppableProps: {
    'data-rfd-droppable-id': '',
    'data-rfd-droppable-context-id': '',
  },
  placeholder: null,
};

const droppableSnapshot: DroppableStateSnapshot = {
  isDraggingOver: false,
  draggingOverWith: null,
  draggingFromThisWith: null,
  isUsingPlaceholder: false,
};

const draggableProvided: DraggableProvided = {
  innerRef: noopRef,
  draggableProps: {
    'data-rfd-draggable-context-id': '',
    'data-rfd-draggable-id': '',
  },
  dragHandleProps: null,
};

const draggableSnapshot: DraggableStateSnapshot = {
  isDragging: false,
  isDropAnimating: false,
  isClone: false,
  dropAnimation: null,
  draggingOver: null,
  combineWith: null,
  combineTargetFor: null,
  mode: null,
};

const draggableRubric: DraggableRubric = {
  draggableId: '',
  type: '',
  source: { droppableId: '', index: 0 },
};

// Inert stand-ins rendered until the real module arrives. They render the same children
// with no-op provided/snapshot values, so consumers keep identical JSX in both states.
const passthrough: DragAndDropComponents = {
  DragDropContext: ({ children }: DragDropContextProps) => <>{children}</>,
  Droppable: ({ children }: DroppableProps) => <>{children(droppableProvided, droppableSnapshot)}</>,
  Draggable: ({ children }: DraggableProps) => <>{children(draggableProvided, draggableSnapshot, draggableRubric)}</>,
};

let loadedModule: DragAndDropModule | undefined;
let modulePromise: Promise<DragAndDropModule> | undefined;

function loadDragAndDrop() {
  modulePromise ??= import(/* webpackChunkName: "drag-and-drop" */ '@hello-pangea/dnd').then((module) => {
    loadedModule = module;
    return module;
  });
  return modulePromise;
}

/**
 * Loads `@hello-pangea/dnd` on demand. Until the module arrives (or while `enabled` is false)
 * it returns inert passthrough components, so callers can render the same JSX unconditionally
 * without pulling the library into their initial chunk.
 */
export function useDragAndDrop(enabled = true): DragAndDropComponents {
  const [module, setModule] = useState(enabled ? loadedModule : undefined);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (loadedModule) {
      setModule(loadedModule);
      return;
    }

    let cancelled = false;

    loadDragAndDrop().then((module) => {
      if (!cancelled) {
        setModule(module);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return (enabled && module) || passthrough;
}
