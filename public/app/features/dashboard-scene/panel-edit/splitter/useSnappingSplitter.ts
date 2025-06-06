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
  collapsed?: boolean;
  // Size of the region left of the handle indicator that is responsive to dragging. At the same time acts as a margin
  // pushing the left pane content left.
  handleSize?: ComponentSize;
  usePixels?: boolean;
  collapseBelowPixels: number;
}

interface PaneState {
  collapsed: boolean;
  snapSize?: number;
}

export function useSnappingSplitter({
  direction,
  initialSize,
  dragPosition,
  collapseBelowPixels,
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

      if (state.collapsed && secondPanePixels > collapseBelowPixels) {
        setState({ collapsed: false });
      }

      if (!state.collapsed && secondPanePixels < collapseBelowPixels) {
        setState({ collapsed: true });
      }
    },
    [state, collapseBelowPixels]
  );

  const onSizeChanged = useCallback(
    (flexSize: number, firstPanePixels: number, secondPanePixels: number) => {
      if (flexSize <= 0 && firstPanePixels <= 0 && secondPanePixels <= 0) {
        return;
      }

      const isSnappedClosed = state.snapSize === 0;

      if (state.collapsed && !isSnappedClosed) {
        setState({ snapSize: 0, collapsed: state.collapsed });
      } else if (state.collapsed && isSnappedClosed) {
        if (usePixels) {
          const snapSize = Math.max(secondPanePixels, initialSize ?? 200);
          setState({ snapSize, collapsed: !state.collapsed });
        } else {
          const snapSize = Math.max(1 - (initialSize ?? 0.5), 1 - flexSize);
          setState({ snapSize, collapsed: !state.collapsed });
        }
      }
    },
    [state, initialSize, usePixels]
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
    if (usePixels) {
      secondaryProps.style.flexBasis = `${state.snapSize}px`;
    } else {
      primaryProps.style = {
        ...primaryProps.style,
        flexGrow: 1 - state.snapSize,
      };
      secondaryProps.style.flexGrow = state.snapSize;
    }
  } else if (state.snapSize === 0) {
    secondaryProps.style.minWidth = 'min-content';
    secondaryProps.style.minHeight = 'min-content';
    secondaryProps.style.overflow = 'unset';

    if (usePixels) {
      secondaryProps.style.flexBasis = '0px';
    } else {
      primaryProps.style.flexGrow = 1;
      secondaryProps.style.flexGrow = 0;
    }
  }

  return { containerProps, primaryProps, secondaryProps, splitterProps, splitterState: state, onToggleCollapse };
}
