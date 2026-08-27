import { renderHook, waitFor } from '@testing-library/react';

import { useDashboardDnd } from './useDashboardDnd';

const mockDndModuleLoaded = jest.fn();

jest.mock('@hello-pangea/dnd', () => {
  mockDndModuleLoaded();

  return {
    DragDropContext: jest.fn(),
    Draggable: jest.fn(),
    Droppable: jest.fn(),
  };
});

describe('useDashboardDnd', () => {
  it('loads drag-and-drop only after edit mode is enabled', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useDashboardDnd(enabled), {
      initialProps: { enabled: false },
    });

    expect(result.current).toBeUndefined();
    expect(mockDndModuleLoaded).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        DragDropContext: expect.any(Function),
        Draggable: expect.any(Function),
        Droppable: expect.any(Function),
      });
    });
    expect(mockDndModuleLoaded).toHaveBeenCalledTimes(1);
  });
});
