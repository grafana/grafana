import { newFunctionNamespace, getExposeAssistantFunctionsConfig } from '@grafana/assistant';
import { PluginExtensionAddedFunctionConfig } from '@grafana/data';

import { dispatch, getState } from '../../../store/store';
import { Block } from '../../../types/explore';
import { addBlock, updateTextBlock, removeBlock, updateExpressionBlockAction, addQueryRow } from '../state/query';
import { buildQueryBlocksFromQueries } from '../state/utils';

/**
 * Returns the first explore pane ID from the current state, or undefined if none exists.
 */
function getFirstExploreId(): string | undefined {
  const state = getState();
  const paneIds = Object.keys(state.explore.panes);
  return paneIds[0];
}

/**
 * Returns the current blocks for a given explore pane, falling back to query-derived blocks.
 */
function getCurrentBlocks(exploreId: string): Block[] {
  const state = getState();
  const pane = state.explore.panes[exploreId];
  if (!pane) {
    return [];
  }

  if (pane.blocks?.length) {
    return pane.blocks;
  }

  return buildQueryBlocksFromQueries(pane.queries);
}

/**
 * Creates the function namespace that exposes Explore block management
 * functions to the Grafana Assistant.
 */
function createExploreBlocksFunctionNamespace() {
  return newFunctionNamespace('explore-blocks', {
    getBlocks: () => {
      const exploreId = getFirstExploreId();
      if (!exploreId) {
        return { error: 'No active explore pane' };
      }
      return { blocks: getCurrentBlocks(exploreId) };
    },

    addTextBlock: (text: string) => {
      const exploreId = getFirstExploreId();
      if (!exploreId) {
        return { error: 'No active explore pane' };
      }
      dispatch(addBlock(exploreId, { type: 'text', text }));
      return { success: true };
    },

    addExpressionBlock: (expression: string) => {
      const exploreId = getFirstExploreId();
      if (!exploreId) {
        return { error: 'No active explore pane' };
      }
      dispatch(addBlock(exploreId, { type: 'expression', expression }));
      return { success: true };
    },

    addQueryBlock: () => {
      const exploreId = getFirstExploreId();
      if (!exploreId) {
        return { error: 'No active explore pane' };
      }
      const state = getState();
      const pane = state.explore.panes[exploreId];
      const queryCount = pane?.queries?.length ?? 0;
      dispatch(addQueryRow(exploreId, queryCount));
      return { success: true };
    },

    updateTextBlock: (index: number, text: string) => {
      const exploreId = getFirstExploreId();
      if (!exploreId) {
        return { error: 'No active explore pane' };
      }

      const blocks = getCurrentBlocks(exploreId);
      if (index < 0 || index >= blocks.length || blocks[index].type !== 'text') {
        return { error: `Invalid text block index: ${index}` };
      }

      dispatch(updateTextBlock(exploreId, index, text));
      return { success: true };
    },

    updateExpressionBlock: (index: number, expression: string) => {
      const exploreId = getFirstExploreId();
      if (!exploreId) {
        return { error: 'No active explore pane' };
      }

      const blocks = getCurrentBlocks(exploreId);
      if (index < 0 || index >= blocks.length || blocks[index].type !== 'expression') {
        return { error: `Invalid expression block index: ${index}` };
      }

      dispatch(updateExpressionBlockAction({ exploreId, index, expression }));
      return { success: true };
    },

    removeBlock: (index: number) => {
      const exploreId = getFirstExploreId();
      if (!exploreId) {
        return { error: 'No active explore pane' };
      }

      const blocks = getCurrentBlocks(exploreId);
      if (index < 0 || index >= blocks.length) {
        return { error: `Invalid block index: ${index}` };
      }

      dispatch(removeBlock(exploreId, index));
      return { success: true };
    },
  });
}

/**
 * Returns the PluginExtensionAddedFunctionConfig that registers
 * Explore block management functions with the Grafana Assistant.
 */
export function getExploreAssistantFunctionConfig(): PluginExtensionAddedFunctionConfig {
  const namespace = createExploreBlocksFunctionNamespace();
  return getExposeAssistantFunctionsConfig([namespace]);
}
