import { renderHook, waitFor } from '@testing-library/react';

import { useDragAndDrop } from './useDragAndDrop';

const mockDndModuleLoaded = jest.fn();
const mockDragDropContext = jest.fn();

jest.mock('@hello-pangea/dnd', () => {
  mockDndModuleLoaded();

  return {
    DragDropContext: mockDragDropContext,
    Draggable: jest.fn(),
    Droppable: jest.fn(),
  };
});

describe('useDragAndDrop', () => {
  it('renders passthrough components and loads the module only once enabled', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useDragAndDrop(enabled), {
      initialProps: { enabled: false },
    });

    // Inert passthroughs are returned before the module loads.
    expect(result.current.DragDropContext).toEqual(expect.any(Function));
    expect(result.current.DragDropContext).not.toBe(mockDragDropContext);
    expect(mockDndModuleLoaded).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.DragDropContext).toBe(mockDragDropContext);
    });
    expect(mockDndModuleLoaded).toHaveBeenCalledTimes(1);
  });
});
