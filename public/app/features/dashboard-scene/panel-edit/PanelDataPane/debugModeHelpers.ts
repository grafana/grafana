/**
 * Helper utilities for debug mode functionality in the panel data pane.
 *
 * Debug mode allows users to interactively enable/disable queries and transformations
 * by dragging a visual line through the pipeline. This module provides utilities to:
 * - Save original item states
 * - Sync items to debug-computed states
 * - Restore items to their original states
 */

import { QueryTransformItem } from './types';

/**
 * Get the current visibility/disabled state of an item.
 *
 * @param item - The query, expression, or transform item
 * @returns true if the item is currently hidden/disabled, false otherwise
 */
export function getItemHiddenState(item: QueryTransformItem): boolean {
  if (item.type === 'query' || item.type === 'expression') {
    return (item.data && 'hide' in item.data && item.data.hide) || false;
  }
  if (item.type === 'transform') {
    return (item.data && 'disabled' in item.data && item.data.disabled) || false;
  }
  return false;
}

/**
 * Get the appropriate toggle function for an item based on its type.
 *
 * @param item - The item to get the toggle function for
 * @param onToggleQuery - Toggle function for queries/expressions
 * @param onToggleTransform - Toggle function for transformations
 * @returns The appropriate toggle function or undefined
 */
function getToggleFunction(
  item: QueryTransformItem,
  onToggleQuery?: (index: number) => void,
  onToggleTransform?: (index: number) => void
): ((index: number) => void) | undefined {
  if (item.type === 'query' || item.type === 'expression') {
    return onToggleQuery;
  }
  if (item.type === 'transform') {
    return onToggleTransform;
  }
  return undefined;
}

/**
 * Sync all items to match their debug-computed states.
 * This toggles item visibility/disabled states to match what the debug line position dictates.
 *
 * @param items - All query, expression, and transform items
 * @param isItemHiddenByDebug - Function that computes if an item should be hidden in debug mode
 * @param onToggleQuery - Callback to toggle query/expression visibility
 * @param onToggleTransform - Callback to toggle transformation disabled state
 */
export function syncItemsToDebugState(
  items: QueryTransformItem[],
  isItemHiddenByDebug: (itemId: string) => boolean | null,
  onToggleQuery?: (index: number) => void,
  onToggleTransform?: (index: number) => void
): void {
  items.forEach((item) => {
    const debugHidden = isItemHiddenByDebug(item.id);
    if (debugHidden === null) {
      return;
    }

    const actuallyHidden = getItemHiddenState(item);

    if (debugHidden !== actuallyHidden) {
      const toggleFn = getToggleFunction(item, onToggleQuery, onToggleTransform);
      toggleFn?.(item.index);
    }
  });
}

/**
 * Restore all items to their original states.
 * This should be called when exiting debug mode to restore user settings.
 *
 * @param items - All query, expression, and transform items
 * @param originalStates - Map of item IDs to their original hidden/disabled states
 * @param onToggleQuery - Callback to toggle query/expression visibility
 * @param onToggleTransform - Callback to toggle transformation disabled state
 */
export function restoreItemStates(
  items: QueryTransformItem[],
  originalStates: Map<string, boolean>,
  onToggleQuery?: (index: number) => void,
  onToggleTransform?: (index: number) => void
): void {
  items.forEach((item) => {
    const originalState = originalStates.get(item.id);
    if (originalState === undefined) {
      return;
    }

    const currentState = getItemHiddenState(item);

    if (originalState !== currentState) {
      const toggleFn = getToggleFunction(item, onToggleQuery, onToggleTransform);
      toggleFn?.(item.index);
    }
  });
}
