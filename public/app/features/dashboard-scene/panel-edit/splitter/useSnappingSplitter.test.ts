import { act, renderHook } from '@testing-library/react';

import { useSplitter } from '@grafana/ui';

import { useSnappingSplitter } from './useSnappingSplitter';

jest.mock('@grafana/ui', () => ({
  useSplitter: jest.fn((options) => ({
    containerProps: { className: '' },
    primaryProps: { className: '', style: {} },
    secondaryProps: { className: '', style: {} },
    splitterProps: { style: {} },
    options,
  })),
}));

describe('useSnappingSplitter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderColumnSplitter(onPaneSizeChanged = jest.fn()) {
    renderHook(() =>
      useSnappingSplitter({
        direction: 'column',
        collapseBelowPixels: 150,
        usePixels: true,
        onPaneSizeChanged,
      })
    );

    return {
      onPaneSizeChanged,
      splitterOptions: jest.mocked(useSplitter).mock.results[0].value.options,
    };
  }

  function renderPrimaryPixelSplitter(onPaneSizeChanged = jest.fn()) {
    renderHook(() =>
      useSnappingSplitter({
        direction: 'row',
        collapseBelowPixels: 150,
        usePixels: true,
        pixelPane: 'primary',
        onPaneSizeChanged,
      })
    );

    return {
      onPaneSizeChanged,
      splitterOptions: jest.mocked(useSplitter).mock.results[0].value.options,
    };
  }

  it('reports the settled secondary pane size when it remains expanded', () => {
    const { onPaneSizeChanged, splitterOptions } = renderColumnSplitter();

    expect(splitterOptions.onSizeChanged).toBeDefined();
    act(() => {
      splitterOptions.onSizeChanged?.(0.5, 500, 240);
    });

    expect(onPaneSizeChanged).toHaveBeenCalledWith(240);
  });

  it('does not persist a size below the collapse threshold', () => {
    const { onPaneSizeChanged, splitterOptions } = renderColumnSplitter();

    expect(splitterOptions.onSizeChanged).toBeDefined();
    act(() => {
      splitterOptions.onSizeChanged?.(0.9, 500, 120);
    });

    expect(onPaneSizeChanged).not.toHaveBeenCalled();
  });

  it('forwards pixelPane to the underlying splitter when pinning the primary pane', () => {
    const { splitterOptions } = renderPrimaryPixelSplitter();

    expect(splitterOptions.pixelPane).toBe('primary');
    expect(splitterOptions.usePixels).toBe(true);
  });

  it('reports the settled primary pane size when collapsing the primary pane', () => {
    const { onPaneSizeChanged, splitterOptions } = renderPrimaryPixelSplitter();

    act(() => {
      splitterOptions.onSizeChanged?.(1, 300, 600);
    });

    expect(onPaneSizeChanged).toHaveBeenCalledWith(300);
  });

  it('does not persist a primary pane size below the collapse threshold', () => {
    const { onPaneSizeChanged, splitterOptions } = renderPrimaryPixelSplitter();

    act(() => {
      splitterOptions.onSizeChanged?.(1, 120, 600);
    });

    expect(onPaneSizeChanged).not.toHaveBeenCalled();
  });
});
