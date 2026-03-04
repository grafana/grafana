import type { InlineToolRunnable } from '@grafana/assistant';

import { dispatch, getState } from '../../../store/store';
import { Block, ExploreItemState } from '../../../types/explore';

import { getExploreBlockTools } from './exploreAssistantIntegration';

jest.mock('../../../store/store', () => ({
  dispatch: jest.fn(),
  getState: jest.fn(),
}));

const mockGetState = getState as jest.MockedFunction<typeof getState>;
const mockDispatch = dispatch as jest.MockedFunction<typeof dispatch>;

function createMockState(blocks: Block[], queries: Array<{ refId: string }> = []) {
  return {
    explore: {
      panes: {
        left: {
          blocks,
          queries,
        } as unknown as ExploreItemState,
      },
    },
  } as unknown as ReturnType<typeof getState>;
}

/** ToolInvokeOptions stub – tools under test do not use manager/signal/timeout */
const stubInvokeOptions = { manager: {} } as Parameters<InlineToolRunnable['invoke']>[1];

/** Helper to invoke a tool by name from the tools array */
async function invokeTool(tools: InlineToolRunnable[], name: string, input: Record<string, unknown> = {}) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Tool "${name}" not found`);
  }
  return tool.invoke(input, stubInvokeOptions);
}

describe('exploreAssistantIntegration – createTool based', () => {
  let tools: InlineToolRunnable[];

  beforeEach(() => {
    jest.clearAllMocks();
    tools = getExploreBlockTools();
  });

  describe('getExploreBlockTools', () => {
    it('should return an array of InlineToolRunnable tools', () => {
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.invoke).toBe('function');
      }
    });

    it('should include all expected tool names', () => {
      const names = tools.map((t) => t.name);
      expect(names).toContain('get_explore_blocks');
      expect(names).toContain('add_explore_text_block');
      expect(names).toContain('add_explore_expression_block');
      expect(names).toContain('add_explore_query_block');
      expect(names).toContain('update_explore_text_block');
      expect(names).toContain('update_explore_expression_block');
      expect(names).toContain('remove_explore_block');
    });
  });

  describe('get_explore_blocks', () => {
    it('should return blocks from the current explore pane', async () => {
      const blocks: Block[] = [
        { type: 'query', queryRef: 'A' },
        { type: 'text', text: 'hello' },
      ];
      mockGetState.mockReturnValue(createMockState(blocks));

      const result = await invokeTool(tools, 'get_explore_blocks');
      expect(JSON.parse(result as string)).toEqual({ blocks });
    });

    it('should return error when no explore pane exists', async () => {
      mockGetState.mockReturnValue({
        explore: { panes: {} },
      } as unknown as ReturnType<typeof getState>);

      const result = await invokeTool(tools, 'get_explore_blocks');
      expect(result).toContain('Error');
    });
  });

  describe('add_explore_text_block', () => {
    it('should dispatch addBlock action with text block', async () => {
      mockGetState.mockReturnValue(createMockState([]));
      const result = await invokeTool(tools, 'add_explore_text_block', { text: 'some text' });
      expect(result).toContain('Successfully');
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should return error when no explore pane exists', async () => {
      mockGetState.mockReturnValue({
        explore: { panes: {} },
      } as unknown as ReturnType<typeof getState>);

      const result = await invokeTool(tools, 'add_explore_text_block', { text: 'text' });
      expect(result).toContain('Error');
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('add_explore_expression_block', () => {
    it('should dispatch addBlock action with expression block', async () => {
      mockGetState.mockReturnValue(createMockState([]));
      const result = await invokeTool(tools, 'add_explore_expression_block', { expression: '$A + $B' });
      expect(result).toContain('Successfully');
      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe('add_explore_query_block', () => {
    it('should dispatch addQueryRow action', async () => {
      mockGetState.mockReturnValue(createMockState([{ type: 'query', queryRef: 'A' }], [{ refId: 'A' }]));
      const result = await invokeTool(tools, 'add_explore_query_block');
      expect(result).toContain('Successfully');
      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe('update_explore_text_block', () => {
    it('should dispatch updateTextBlock action for valid text block', async () => {
      const blocks: Block[] = [
        { type: 'query', queryRef: 'A' },
        { type: 'text', text: 'old text' },
      ];
      mockGetState.mockReturnValue(createMockState(blocks));

      const result = await invokeTool(tools, 'update_explore_text_block', { index: 1, text: 'new text' });
      expect(result).toContain('Successfully');
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should return error for invalid index', async () => {
      const blocks: Block[] = [{ type: 'query', queryRef: 'A' }];
      mockGetState.mockReturnValue(createMockState(blocks));

      const result = await invokeTool(tools, 'update_explore_text_block', { index: 5, text: 'text' });
      expect(result).toContain('Error');
    });

    it('should return error when targeting non-text block', async () => {
      const blocks: Block[] = [{ type: 'query', queryRef: 'A' }];
      mockGetState.mockReturnValue(createMockState(blocks));

      const result = await invokeTool(tools, 'update_explore_text_block', { index: 0, text: 'text' });
      expect(result).toContain('Error');
    });
  });

  describe('update_explore_expression_block', () => {
    it('should dispatch updateExpressionBlock action for valid expression block', async () => {
      const blocks: Block[] = [{ type: 'expression', expression: '$A + $B' }];
      mockGetState.mockReturnValue(createMockState(blocks));

      const result = await invokeTool(tools, 'update_explore_expression_block', {
        index: 0,
        expression: '$A * $B',
      });
      expect(result).toContain('Successfully');
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should return error for invalid index', async () => {
      const blocks: Block[] = [{ type: 'query', queryRef: 'A' }];
      mockGetState.mockReturnValue(createMockState(blocks));

      const result = await invokeTool(tools, 'update_explore_expression_block', { index: 0, expression: 'expr' });
      expect(result).toContain('Error');
    });
  });

  describe('remove_explore_block', () => {
    it('should dispatch removeBlock action for valid index', async () => {
      const blocks: Block[] = [
        { type: 'query', queryRef: 'A' },
        { type: 'text', text: 'hello' },
      ];
      mockGetState.mockReturnValue(createMockState(blocks));

      const result = await invokeTool(tools, 'remove_explore_block', { index: 1 });
      expect(result).toContain('Successfully');
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should return error for out of range index', async () => {
      const blocks: Block[] = [{ type: 'query', queryRef: 'A' }];
      mockGetState.mockReturnValue(createMockState(blocks));

      const result = await invokeTool(tools, 'remove_explore_block', { index: 5 });
      expect(result).toContain('Error');
    });

    it('should throw validation error for negative index', async () => {
      const blocks: Block[] = [{ type: 'query', queryRef: 'A' }];
      mockGetState.mockReturnValue(createMockState(blocks));

      await expect(invokeTool(tools, 'remove_explore_block', { index: -1 })).rejects.toThrow(
        'index is required and must be a non-negative integer'
      );
    });
  });
});
