import {
  type DraggableProps,
  type DraggableProvided,
  type DraggableRubric,
  type DraggableStateSnapshot,
  type DragDropContextProps,
  type DroppableProps,
  type DroppableProvided,
  type DroppableStateSnapshot,
} from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';

type DragAndDropModule = typeof import('@hello-pangea/dnd');

interface DataLinksDragAndDropComponents {
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
const passthrough: DataLinksDragAndDropComponents = {
  DragDropContext: ({ children }: DragDropContextProps) => <>{children}</>,
  Droppable: ({ children }: DroppableProps) => <>{children(droppableProvided, droppableSnapshot)}</>,
  Draggable: ({ children }: DraggableProps) => <>{children(draggableProvided, draggableSnapshot, draggableRubric)}</>,
};

let loadedModule: DragAndDropModule | undefined;
let modulePromise: Promise<DragAndDropModule> | undefined;

/**
 * Loads `@hello-pangea/dnd` on demand. Until the module arrives it returns inert
 * passthrough components, so callers can render the same JSX unconditionally without
 * pulling the library into the initial `@grafana/ui` chunk.
 */
export function useDataLinksDragAndDrop(): DataLinksDragAndDropComponents {
  const [module, setModule] = useState(loadedModule);

  useEffect(() => {
    if (loadedModule) {
      setModule(loadedModule);
      return;
    }

    let cancelled = false;

    modulePromise ??= import(/* webpackChunkName: "drag-and-drop" */ '@hello-pangea/dnd').then((mod) => {
      loadedModule = mod;
      return mod;
    });
    modulePromise.then((mod) => {
      if (!cancelled) {
        setModule(mod);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return module ?? passthrough;
}
