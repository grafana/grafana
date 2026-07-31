import { useState, useCallback } from 'react';

import { type ComponentSize, type DragHandlePosition, useSplitter } from '@grafana/ui';

export interface UseSnappingSplitterOptions {
  /**
   * The initial size of the primary pane between 0-1, defaults to 0.5
   * If `usePixels` is true, this is the initial size in pixels of the pinned pane.
   */
  initialSize?: number;
  direction: 'row' | 'column';
  dragPosition?: DragHandlePosition;
  collapsed?: boolean;
  // Size of the region left of the handle indicator that is responsive to dragging. At the same time acts as a margin
  // pushing the left pane content left.
  handleSize?: ComponentSize;
  usePixels?: boolean;
  /**
   * Which pane is pinned to pixels and collapses past the threshold. Defaults to `'secondary'`
   * (right/bottom); use `'primary'` for a left/top pane such as a sidebar.
   */
  pixelPane?: 'primary' | 'secondary';
  collapseBelowPixels: number;

  /* Disables the splitter, hiding all of its styles */
  disabled?: boolean;

  /**
   * Persist hook: called when a resize ends above the threshold, with the collapsing pane's settled
   * size in pixels and the primary pane's share of the container (0-1). Use `flexSize` for a
   * flex-sized splitter, whose size is otherwise only stored on the DOM and lost on remount.
   */
  onPaneSizeChanged?: (sizePixels: number, flexSize: number) => void;
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
  pixelPane = 'secondary',
  disabled,
  onPaneSizeChanged,
}: UseSnappingSplitterOptions) {
  const [state, setState] = useState<PaneState>({
    collapsed: collapsed ?? false,
    snapSize: collapsed ? 0 : undefined,
  });

  // The pinned pane is also the one that collapses; the logic below targets it either way.
  const collapsePrimary = pixelPane === 'primary';

  const onResizing = useCallback(
    (flexSize: number, firstPanePixels: number, secondPanePixels: number) => {
      if (flexSize <= 0 && firstPanePixels <= 0 && secondPanePixels <= 0) {
        return;
      }

      const panePixels = collapsePrimary ? firstPanePixels : secondPanePixels;

      // Derived from the latest state, not a captured one: the final pointermove and the pointerup
      // of a single gesture land in the same commit, so a snapshot would be stale by then.
      setState((prev) => {
        if (prev.collapsed && panePixels > collapseBelowPixels) {
          return { collapsed: false };
        }

        if (!prev.collapsed && panePixels < collapseBelowPixels) {
          return { collapsed: true };
        }

        return prev;
      });
    },
    [collapseBelowPixels, collapsePrimary]
  );

  const onSizeChanged = useCallback(
    (flexSize: number, firstPanePixels: number, secondPanePixels: number) => {
      if (flexSize <= 0 && firstPanePixels <= 0 && secondPanePixels <= 0) {
        return;
      }

      const panePixels = collapsePrimary ? firstPanePixels : secondPanePixels;

      setState((prev) => {
        const isSnappedClosed = prev.snapSize === 0;

        if (prev.collapsed && !isSnappedClosed) {
          return { snapSize: 0, collapsed: prev.collapsed };
        }

        if (prev.collapsed && isSnappedClosed) {
          if (usePixels) {
            return { snapSize: Math.max(panePixels, initialSize ?? 200), collapsed: !prev.collapsed };
          }

          return { snapSize: Math.max(1 - (initialSize ?? 0.5), 1 - flexSize), collapsed: !prev.collapsed };
        }

        // Settled while open: release the forced size. `snapSize` pins the pane on every render, so
        // leaving it set would let the next render — including the one the persist call below
        // triggers — snap the pane back to it and undo the resize the user just made.
        if (prev.snapSize !== undefined) {
          return { collapsed: prev.collapsed };
        }

        return prev;
      });

      // Only persist while open, so collapsing doesn't overwrite the restore size with ~0.
      if (panePixels >= collapseBelowPixels) {
        onPaneSizeChanged?.(panePixels, flexSize);
      }
    },
    [initialSize, usePixels, collapsePrimary, collapseBelowPixels, onPaneSizeChanged]
  );

  const onToggleCollapse = useCallback(() => {
    setState((prev) => ({ collapsed: !prev.collapsed }));
  }, []);

  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    direction: direction,
    dragPosition: dragPosition,
    handleSize: handleSize,
    initialSize: initialSize,
    usePixels: usePixels,
    pixelPane: pixelPane,
    onResizing,
    onSizeChanged,
  });

  // This does cause the loss of the adjustment position when toggling disabled on and off again.
  // Fixing this properly would require changing how useSplitter works to not both pass and
  // adjust styles directly on the element by ref. That causes a React conflict.
  if (disabled) {
    containerProps.className = '';
    primaryProps.className = '';
    primaryProps.style = {};
    secondaryProps.className = '';
    secondaryProps.style = {};
    splitterProps.style.display = 'none';
    return {
      containerProps,
      primaryProps,
      secondaryProps,
      splitterProps,
      splitterState: { collapsed: false },
      onToggleCollapse,
    };
  }

  // Override styles on the collapsing pane; the other fills the remaining space.
  const collapsingProps = collapsePrimary ? primaryProps : secondaryProps;
  const fillingProps = collapsePrimary ? secondaryProps : primaryProps;

  // This is to allow resizing it beyond the content dimensions
  collapsingProps.style.overflow = 'hidden';
  collapsingProps.style.minWidth = 'unset';
  collapsingProps.style.minHeight = 'unset';

  if (state.snapSize) {
    if (usePixels) {
      collapsingProps.style.flexBasis = `${state.snapSize}px`;
    } else {
      fillingProps.style = {
        ...fillingProps.style,
        flexGrow: 1 - state.snapSize,
      };
      collapsingProps.style.flexGrow = state.snapSize;
    }
  } else if (state.snapSize === 0) {
    collapsingProps.style.minWidth = 'min-content';
    collapsingProps.style.minHeight = 'min-content';
    collapsingProps.style.overflow = 'unset';

    if (usePixels) {
      collapsingProps.style.flexBasis = '0px';
    } else {
      fillingProps.style.flexGrow = 1;
      collapsingProps.style.flexGrow = 0;
    }
  }

  return { containerProps, primaryProps, secondaryProps, splitterProps, splitterState: state, onToggleCollapse };
}
