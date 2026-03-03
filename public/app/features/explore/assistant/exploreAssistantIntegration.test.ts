import { dispatch, getState } from '../../../store/store';
import { Block, ExploreItemState } from '../../../types/explore';

import { getExploreAssistantFunctionConfig } from './exploreAssistantIntegration';

jest.mock('../../../store/store', () => ({
  dispatch: jest.fn(),
  getState: jest.fn(),
}));

jest.mock('@grafana/assistant', () => ({
  newFunctionNamespace: jest.fn((namespace: string, functions: Record<string, Function>) => ({
    namespace,
    functions,
  })),
  getExposeAssistantFunctionsConfig: jest.fn((namespaces: Array<{ namespace: string; functions: Record<string, Function> }>) => ({
    title: 'Explore blocks assistant functions',
    targets: 'grafana-assistant-app/callback/v0-alpha',
    fn: () => namespaces,
  })),
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
  } as ReturnType<typeof getState>;
}

describe('exploreAssistantIntegration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getExploreAssistantFunctionConfig', () => {
    it('should return a valid PluginExtensionAddedFunctionConfig', () => {
      const config = getExploreAssistantFunctionConfig();
      expect(config).toBeDefined();
      expect(config.title).toBeDefined();
      expect(config.targets).toBe('grafana-assistant-app/callback/v0-alpha');
      expect(config.fn).toBeDefined();
    });
  });

  describe('function namespace', () => {
    let functions: Record<string, Function>;

    beforeEach(() => {
      const config = getExploreAssistantFunctionConfig();
      const namespaces = (config.fn as Function)();
      functions = namespaces[0].functions;
    });

    describe('getBlocks', () => {
      it('should return blocks from the current explore pane', () => {
        const blocks: Block[] = [
          { type: 'query', queryRef: 'A' },
          { type: 'text', text: 'hello' },
        ];
        mockGetState.mockReturnValue(createMockState(blocks));

        const result = functions.getBlocks();
        expect(result).toEqual({ blocks });
      });

      it('should return error when no explore pane exists', () => {
        mockGetState.mockReturnValue({
          explore: { panes: {} },
        } as ReturnType<typeof getState>);

        const result = functions.getBlocks();
        expect(result).toEqual({ error: 'No active explore pane' });
      });
    });

    describe('addTextBlock', () => {
      it('should dispatch addBlock action with text block', () => {
        mockGetState.mockReturnValue(createMockState([]));
        const result = functions.addTextBlock('some text');
        expect(result).toEqual({ success: true });
        expect(mockDispatch).toHaveBeenCalled();
      });

      it('should return error when no explore pane exists', () => {
        mockGetState.mockReturnValue({
          explore: { panes: {} },
        } as ReturnType<typeof getState>);

        const result = functions.addTextBlock('text');
        expect(result).toEqual({ error: 'No active explore pane' });
        expect(mockDispatch).not.toHaveBeenCalled();
      });
    });

    describe('addExpressionBlock', () => {
      it('should dispatch addBlock action with expression block', () => {
        mockGetState.mockReturnValue(createMockState([]));
        const result = functions.addExpressionBlock('SELECT * FROM A');
        expect(result).toEqual({ success: true });
        expect(mockDispatch).toHaveBeenCalled();
      });
    });

    describe('addQueryBlock', () => {
      it('should dispatch addQueryRow action', () => {
        mockGetState.mockReturnValue(
          createMockState([{ type: 'query', queryRef: 'A' }], [{ refId: 'A' }])
        );
        const result = functions.addQueryBlock();
        expect(result).toEqual({ success: true });
        expect(mockDispatch).toHaveBeenCalled();
      });
    });

    describe('updateTextBlock', () => {
      it('should dispatch updateTextBlock action for valid text block', () => {
        const blocks: Block[] = [
          { type: 'query', queryRef: 'A' },
          { type: 'text', text: 'old text' },
        ];
        mockGetState.mockReturnValue(createMockState(blocks));

        const result = functions.updateTextBlock(1, 'new text');
        expect(result).toEqual({ success: true });
        expect(mockDispatch).toHaveBeenCalled();
      });

      it('should return error for invalid index', () => {
        const blocks: Block[] = [{ type: 'query', queryRef: 'A' }];
        mockGetState.mockReturnValue(createMockState(blocks));

        const result = functions.updateTextBlock(5, 'text');
        expect(result).toEqual({ error: 'Invalid text block index: 5' });
      });

      it('should return error when targeting non-text block', () => {
        const blocks: Block[] = [{ type: 'query', queryRef: 'A' }];
        mockGetState.mockReturnValue(createMockState(blocks));

        const result = functions.updateTextBlock(0, 'text');
        expect(result).toEqual({ error: 'Invalid text block index: 0' });
      });
    });

    describe('updateExpressionBlock', () => {
      it('should dispatch updateExpressionBlock action for valid expression block', () => {
        const blocks: Block[] = [{ type: 'expression', expression: 'SELECT * FROM A' }];
        mockGetState.mockReturnValue(createMockState(blocks));

        const result = functions.updateExpressionBlock(0, 'SELECT count(*) FROM A');
        expect(result).toEqual({ success: true });
        expect(mockDispatch).toHaveBeenCalled();
      });

      it('should return error for invalid index', () => {
        const blocks: Block[] = [{ type: 'query', queryRef: 'A' }];
        mockGetState.mockReturnValue(createMockState(blocks));

        const result = functions.updateExpressionBlock(0, 'expr');
        expect(result).toEqual({ error: 'Invalid expression block index: 0' });
      });
    });

    describe('removeBlock', () => {
      it('should dispatch removeBlock action for valid index', () => {
        const blocks: Block[] = [
          { type: 'query', queryRef: 'A' },
          { type: 'text', text: 'hello' },
        ];
        mockGetState.mockReturnValue(createMockState(blocks));

        const result = functions.removeBlock(1);
        expect(result).toEqual({ success: true });
        expect(mockDispatch).toHaveBeenCalled();
      });

      it('should return error for out of range index', () => {
        const blocks: Block[] = [{ type: 'query', queryRef: 'A' }];
        mockGetState.mockReturnValue(createMockState(blocks));

        const result = functions.removeBlock(5);
        expect(result).toEqual({ error: 'Invalid block index: 5' });
      });

      it('should return error for negative index', () => {
        const blocks: Block[] = [{ type: 'query', queryRef: 'A' }];
        mockGetState.mockReturnValue(createMockState(blocks));

        const result = functions.removeBlock(-1);
        expect(result).toEqual({ error: 'Invalid block index: -1' });
      });
    });
  });
});
