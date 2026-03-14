import { createTool } from '@grafana/assistant';
import type { InlineToolRunnable, ToolOutput } from '@grafana/assistant';

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

// --- Tool: get_explore_blocks ---
const getBlocksTool: InlineToolRunnable = createTool(
  async (): Promise<ToolOutput> => {
    const exploreId = getFirstExploreId();
    if (!exploreId) {
      return 'Error: No active explore pane';
    }
    const blocks = getCurrentBlocks(exploreId);
    return JSON.stringify({ blocks });
  },
  {
    name: 'get_explore_blocks',
    description:
      'Get the current list of blocks in the Explore view. ' +
      'Blocks can be of type "query" (a data source query), "text" (a markdown note), or "expression" (a math expression). ' +
      'Returns the full block list with their types, indices, and content.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      additionalProperties: false,
    },
    validate: () => ({}),
  }
);

// --- Tool: add_text_block ---
interface AddTextBlockInput {
  text: string;
}

const addTextBlockTool: InlineToolRunnable = createTool(
  async (input: AddTextBlockInput): Promise<ToolOutput> => {
    const exploreId = getFirstExploreId();
    if (!exploreId) {
      return 'Error: No active explore pane';
    }
    dispatch(addBlock(exploreId, { type: 'text', text: input.text }));
    return `Successfully added text block`;
  },
  {
    name: 'add_explore_text_block',
    description:
      'Add a new text/note block to the Explore view. ' +
      'Text blocks contain markdown text that can be used for documentation, annotations, or notes alongside queries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string' as const,
          description: 'The markdown text content for the new text block',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
    validate: (input) => {
      if (typeof input.text !== 'string' || !input.text) {
        throw new Error('text is required and must be a non-empty string');
      }
      return input as AddTextBlockInput;
    },
  }
);

// --- Tool: add_expression_block ---
interface AddExpressionBlockInput {
  expression: string;
}

const addExpressionBlockTool: InlineToolRunnable = createTool(
  async (input: AddExpressionBlockInput): Promise<ToolOutput> => {
    const exploreId = getFirstExploreId();
    if (!exploreId) {
      return 'Error: No active explore pane';
    }
    dispatch(addBlock(exploreId, { type: 'expression', expression: input.expression }));
    return `Successfully added expression block`;
  },
  {
    name: 'add_explore_expression_block',
    description:
      'Add a new math expression block to the Explore view. ' +
      'Expression blocks contain math expressions that can reference query results (e.g. "$A + $B").',
    inputSchema: {
      type: 'object' as const,
      properties: {
        expression: {
          type: 'string' as const,
          description: 'The math expression, can reference query results using $refId syntax (e.g. "$A + $B")',
        },
      },
      required: ['expression'],
      additionalProperties: false,
    },
    validate: (input) => {
      if (typeof input.expression !== 'string' || !input.expression) {
        throw new Error('expression is required and must be a non-empty string');
      }
      return input as AddExpressionBlockInput;
    },
  }
);

// --- Tool: add_query_block ---
const addQueryBlockTool: InlineToolRunnable = createTool(
  async (): Promise<ToolOutput> => {
    const exploreId = getFirstExploreId();
    if (!exploreId) {
      return 'Error: No active explore pane';
    }
    const state = getState();
    const pane = state.explore.panes[exploreId];
    const queryCount = pane?.queries?.length ?? 0;
    dispatch(addQueryRow(exploreId, queryCount));
    return `Successfully added a new query block`;
  },
  {
    name: 'add_explore_query_block',
    description:
      'Add a new empty query block to the Explore view. ' +
      'Query blocks allow the user to write data source queries. The new query will use the currently selected data source.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      additionalProperties: false,
    },
    validate: () => ({}),
  }
);

// --- Tool: update_text_block ---
interface UpdateTextBlockInput {
  index: number;
  text: string;
}

const updateTextBlockTool: InlineToolRunnable = createTool(
  async (input: UpdateTextBlockInput): Promise<ToolOutput> => {
    const exploreId = getFirstExploreId();
    if (!exploreId) {
      return 'Error: No active explore pane';
    }

    const blocks = getCurrentBlocks(exploreId);
    if (input.index < 0 || input.index >= blocks.length || blocks[input.index].type !== 'text') {
      return `Error: Invalid text block index: ${input.index}. Must point to an existing text block.`;
    }

    dispatch(updateTextBlock(exploreId, input.index, input.text));
    return `Successfully updated text block at index ${input.index}`;
  },
  {
    name: 'update_explore_text_block',
    description:
      'Update the content of an existing text block in the Explore view. ' +
      'Use get_explore_blocks first to find the correct block index. The block at the given index must be a text block.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        index: {
          type: 'integer' as const,
          description: 'The zero-based index of the text block to update (use get_explore_blocks to find it)',
          minimum: 0,
        },
        text: {
          type: 'string' as const,
          description: 'The new markdown text content for the block',
        },
      },
      required: ['index', 'text'],
      additionalProperties: false,
    },
    validate: (input) => {
      if (typeof input.index !== 'number' || !Number.isInteger(input.index) || input.index < 0) {
        throw new Error('index is required and must be a non-negative integer');
      }
      if (typeof input.text !== 'string') {
        throw new Error('text is required and must be a string');
      }
      return input as UpdateTextBlockInput;
    },
  }
);

// --- Tool: update_expression_block ---
interface UpdateExpressionBlockInput {
  index: number;
  expression: string;
}

const updateExpressionBlockTool: InlineToolRunnable = createTool(
  async (input: UpdateExpressionBlockInput): Promise<ToolOutput> => {
    const exploreId = getFirstExploreId();
    if (!exploreId) {
      return 'Error: No active explore pane';
    }

    const blocks = getCurrentBlocks(exploreId);
    if (input.index < 0 || input.index >= blocks.length || blocks[input.index].type !== 'expression') {
      return `Error: Invalid expression block index: ${input.index}. Must point to an existing expression block.`;
    }

    dispatch(updateExpressionBlockAction({ exploreId, index: input.index, expression: input.expression }));
    return `Successfully updated expression block at index ${input.index}`;
  },
  {
    name: 'update_explore_expression_block',
    description:
      'Update the expression of an existing expression block in the Explore view. ' +
      'Use get_explore_blocks first to find the correct block index. The block at the given index must be an expression block.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        index: {
          type: 'integer' as const,
          description: 'The zero-based index of the expression block to update (use get_explore_blocks to find it)',
          minimum: 0,
        },
        expression: {
          type: 'string' as const,
          description: 'The new math expression, can reference query results using $refId syntax (e.g. "$A + $B")',
        },
      },
      required: ['index', 'expression'],
      additionalProperties: false,
    },
    validate: (input) => {
      if (typeof input.index !== 'number' || !Number.isInteger(input.index) || input.index < 0) {
        throw new Error('index is required and must be a non-negative integer');
      }
      if (typeof input.expression !== 'string') {
        throw new Error('expression is required and must be a string');
      }
      return input as UpdateExpressionBlockInput;
    },
  }
);

// --- Tool: remove_block ---
interface RemoveBlockInput {
  index: number;
}

const removeBlockTool: InlineToolRunnable = createTool(
  async (input: RemoveBlockInput): Promise<ToolOutput> => {
    const exploreId = getFirstExploreId();
    if (!exploreId) {
      return 'Error: No active explore pane';
    }

    const blocks = getCurrentBlocks(exploreId);
    if (input.index < 0 || input.index >= blocks.length) {
      return `Error: Invalid block index: ${input.index}. Must be between 0 and ${blocks.length - 1}.`;
    }

    dispatch(removeBlock(exploreId, input.index));
    return `Successfully removed block at index ${input.index}`;
  },
  {
    name: 'remove_explore_block',
    description:
      'Remove a block from the Explore view by its index. ' +
      'Can remove any block type (query, text, or expression). ' +
      'Use get_explore_blocks first to find the correct block index. ' +
      'If a query block is removed, the associated query is also removed.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        index: {
          type: 'integer' as const,
          description: 'The zero-based index of the block to remove (use get_explore_blocks to find it)',
          minimum: 0,
        },
      },
      required: ['index'],
      additionalProperties: false,
    },
    validate: (input) => {
      if (typeof input.index !== 'number' || !Number.isInteger(input.index) || input.index < 0) {
        throw new Error('index is required and must be a non-negative integer');
      }
      return input as RemoveBlockInput;
    },
  }
);

/**
 * Returns all Explore block manipulation tools as InlineToolRunnable[].
 * These can be passed to useInlineAssistant().generate({ tools }) or
 * provided through the assistant page context.
 */
export function getExploreBlockTools(): InlineToolRunnable[] {
  return [
    getBlocksTool,
    addTextBlockTool,
    addExpressionBlockTool,
    addQueryBlockTool,
    updateTextBlockTool,
    updateExpressionBlockTool,
    removeBlockTool,
  ];
}
