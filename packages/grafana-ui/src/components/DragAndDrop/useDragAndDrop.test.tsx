import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createContext, type PropsWithChildren, useContext } from 'react';

import { useDragAndDrop } from './useDragAndDrop';

const mockDndModuleLoaded = jest.fn();
const MockDndContext = createContext(false);
const mockDndComponents = {
  DragDropContext: jest.fn(({ children }: PropsWithChildren) => (
    <MockDndContext.Provider value={true}>{children}</MockDndContext.Provider>
  )),
  Draggable: jest.fn(() => {
    if (!useContext(MockDndContext)) {
      throw new Error('Draggable must be rendered inside DragDropContext');
    }

    return <span>Draggable row</span>;
  }),
  Droppable: jest.fn(),
};
let resolveDndModule: (module: typeof mockDndComponents) => void;
const mockDndModulePromise = new Promise<typeof mockDndComponents>((resolve) => {
  resolveDndModule = resolve;
});

jest.mock('@hello-pangea/dnd', () => {
  mockDndModuleLoaded();

  // Preserve the promise through import interop so the test controls when loading finishes.
  return Object.assign(mockDndModulePromise, { __esModule: true });
});

describe('useDragAndDrop', () => {
  it('loads once and uses the same loaded components throughout a newly enabled tree', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useDragAndDrop(enabled), {
      initialProps: { enabled: false },
    });
    const passthroughComponents = {
      DragDropContext: result.current.DragDropContext,
      Draggable: result.current.Draggable,
      Droppable: result.current.Droppable,
    };

    expect(result.current.isReady).toBe(false);
    expect(result.current.DragDropContext).not.toBe(mockDndComponents.DragDropContext);
    expect(mockDndModuleLoaded).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(mockDndModuleLoaded).toHaveBeenCalledTimes(1));
    expect(result.current).toMatchObject({ ...passthroughComponents, isReady: false });

    await act(async () => {
      resolveDndModule(mockDndComponents);
      await mockDndModulePromise;
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({ ...mockDndComponents, isReady: true });
    });

    rerender({ enabled: false });
    expect(result.current).toMatchObject({ ...passthroughComponents, isReady: false });

    rerender({ enabled: true });
    expect(result.current).toMatchObject({ ...mockDndComponents, isReady: true });
    expect(mockDndModuleLoaded).toHaveBeenCalledTimes(1);

    const { rerender: rerenderTree } = render(<DndTree enabled={false} />);

    rerenderTree(<DndTree enabled />);

    expect(screen.getByText('Draggable row')).toBeInTheDocument();
  });
});

function DndTree({ enabled }: { enabled: boolean }) {
  const { DragDropContext } = useDragAndDrop(enabled);

  return <DragDropContext onDragEnd={jest.fn()}>{enabled && <DndItem />}</DragDropContext>;
}

function DndItem() {
  const { Draggable } = useDragAndDrop();

  return (
    <Draggable draggableId="row" index={0}>
      {() => null}
    </Draggable>
  );
}
