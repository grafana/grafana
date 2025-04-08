import { useState, useCallback } from 'react';

import { ComponentSize, DragHandlePosition, useSplitter } from '@grafana/ui';

export interface UseSnappingSplitterOptions {
  /**
   * The initial size of the primary pane between 0-1, defaults to 0.5
   * If `usePixels` is true, this is the initial size in pixels of the second pane.
   */
  initialSize?: number;
  direction: 'row' | 'column';
  dragPosition?: DragHandlePosition;
  paneOptions: PaneOptions;
  collapsed?: boolean;
  // Size of the region left of the handle indicator that is responsive to dragging. At the same time acts as a margin
  // pushing the left pane content left.
  handleSize?: ComponentSize;
  usePixels?: boolean;
}

interface PaneOptions {
  collapseBelowPixels: number;
  snapOpenToPixels?: number;
}

interface PaneState {
  collapsed: boolean;
  snapSize?: number;
}

export function useSnappingSplitter({
  direction,
  initialSize,
  dragPosition,
  paneOptions,
  collapsed,
  handleSize,
  usePixels,
}: UseSnappingSplitterOptions) {
  const [state, setState] = useState<PaneState>({
    collapsed: collapsed ?? false,
    snapSize: collapsed ? 0 : undefined,
  });

  const onResizing = useCallback(
    (flexSize: number, firstPanePixels: number, secondPanePixels: number) => {
      if (flexSize <= 0 && firstPanePixels <= 0 && secondPanePixels <= 0) {
        return;
      }

      if (state.collapsed && secondPanePixels > paneOptions.collapseBelowPixels) {
        setState({ collapsed: false });
      }

      if (!state.collapsed && secondPanePixels < paneOptions.collapseBelowPixels) {
        setState({ collapsed: true });
      }
    },
    [state, paneOptions.collapseBelowPixels]
  );

  const onSizeChanged = useCallback(
    (flexSize: number, pixelSize: number) => {
      if (flexSize <= 0 && pixelSize <= 0) {
        return;
      }

      const newSecondPaneSize = 1 - flexSize;
      const isSnappedClosed = state.snapSize === 0;
      const sizeOfBothPanes = pixelSize / flexSize;
      const snapOpenToPixels = paneOptions.snapOpenToPixels ?? sizeOfBothPanes / 2;
      const snapSize = snapOpenToPixels / sizeOfBothPanes;

      if (state.collapsed) {
        if (isSnappedClosed) {
          setState({ snapSize: Math.max(newSecondPaneSize, snapSize), collapsed: false });
        } else {
          setState({ snapSize: 0, collapsed: true });
        }
      } else if (isSnappedClosed) {
        setState({ snapSize: newSecondPaneSize, collapsed: false });
      }
    },
    [state, paneOptions.snapOpenToPixels]
  );

  const onToggleCollapse = useCallback(() => {
    setState({ collapsed: !state.collapsed });
  }, [state.collapsed]);

  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    direction: direction,
    dragPosition: dragPosition,
    handleSize: handleSize,
    initialSize: initialSize,
    usePixels: usePixels,
    onResizing,
    onSizeChanged,
  });

  // This is to allow resizing it beyond the content dimensions
  secondaryProps.style.overflow = 'hidden';
  secondaryProps.style.minWidth = 'unset';
  secondaryProps.style.minHeight = 'unset';

  if (state.snapSize) {
    primaryProps.style = {
      ...primaryProps.style,
      flexGrow: 1 - state.snapSize,
    };
    secondaryProps.style.flexGrow = state.snapSize;
  } else if (state.snapSize === 0) {
    primaryProps.style.flexGrow = 1;
    secondaryProps.style.flexGrow = 0;
    secondaryProps.style.minWidth = 'unset';
    secondaryProps.style.minHeight = 'unset';
    secondaryProps.style.overflow = 'unset';
  }

  return { containerProps, primaryProps, secondaryProps, splitterProps, splitterState: state, onToggleCollapse };
}
