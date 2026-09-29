import { act, renderHook, waitFor } from '@testing-library/react';

import { useDragAndDrop } from './useDragAndDrop';

const mockDndModuleLoaded = jest.fn();
const mockDndComponents = {
  DragDropContext: jest.fn(),
  Draggable: jest.fn(),
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
  it('is ready only when enabled with loaded components, and reuses the module after re-enabling', async () => {
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
  });
});
