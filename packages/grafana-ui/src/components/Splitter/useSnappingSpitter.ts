import React, { useCallback } from 'react';

import { DragHandlePosition } from '../DragHandle/DragHandle';

import { useSplitter } from './useSplitter';

export interface UseSnappingSplitterOptions {
  /**
   * The initial size of the primary pane between 0-1, defaults to 0.5
   */
  initialSize?: number;
  direction: 'row' | 'column';
  dragPosition?: DragHandlePosition;
  paneOptions: PaneOptions;
}

interface PaneOptions {
  collapseBelowPixels: number;
  snapOpenToPixels?: number;
}

interface PaneState {
  collapsed: boolean;
  snapSize?: number;
}

export function useSnappingSplitter(options: UseSnappingSplitterOptions) {
  const { paneOptions } = options;

  const [state, setState] = React.useState<PaneState>({ collapsed: false });

  const onResizing = useCallback(
    (flexSize: number, pixelSize: number) => {
      if (flexSize <= 0 && pixelSize <= 0) {
        return;
      }

      const optionsPixelSize = (pixelSize / flexSize) * (1 - flexSize);

      if (state.collapsed && optionsPixelSize > paneOptions.collapseBelowPixels) {
        setState({ collapsed: false });
      }

      if (!state.collapsed && optionsPixelSize < paneOptions.collapseBelowPixels) {
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

  const { containerProps, firstPaneProps, secondPaneProps, splitterProps } = useSplitter({
    ...options,
    onResizing,
    onSizeChanged,
  });

  // This is to allow resizing it beyond the content dimensions
  secondPaneProps.style.overflow = 'hidden';
  secondPaneProps.style.minWidth = 'unset';
  secondPaneProps.style.minHeight = 'unset';

  if (state.snapSize) {
    firstPaneProps.style = {
      ...firstPaneProps.style,
      flexGrow: 1 - state.snapSize,
    };
    secondPaneProps.style.flexGrow = state.snapSize;
  } else if (state.snapSize === 0) {
    firstPaneProps.style.flexGrow = 1;
    secondPaneProps.style.flexGrow = 0;
    secondPaneProps.style.minWidth = 'unset';
    secondPaneProps.style.minHeight = 'unset';
    secondPaneProps.style.overflow = 'unset';
  }

  return { containerProps, firstPaneProps, secondPaneProps, splitterProps, splitterState: state, onToggleCollapse };
}
