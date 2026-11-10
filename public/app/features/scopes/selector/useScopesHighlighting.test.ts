import { renderHook } from '@testing-library/react';

import { type ScopeNode } from '@grafana/data';

import { type NodesMap, type SelectedScope } from './types';
import { KeyboardAction } from './useKeyboardInteractions';
import { useScopesHighlighting } from './useScopesHighlighting';

const mockChangeScopes = jest.fn();
// Fails loudly when a test triggers a selection before rendering, because an unrendered hook has captured nothing.
let mockOnKeyboardSelect: (nodeId: string | undefined, action: KeyboardAction) => void = () => {
  throw new Error('Render the hook before triggering a keyboard selection');
};

jest.mock('./useScopeActions', () => ({
  useScopeActions: () => ({ changeScopes: mockChangeScopes }),
}));

// The keyboard handling itself is covered in useKeyboardInteractions.test.tsx. Here the callback it is given is
// captured, so the tests can trigger a selection the way a key press would.
jest.mock('./useKeyboardInteractions', () => ({
  ...jest.requireActual('./useKeyboardInteractions'),
  useKeyboardInteraction: (
    _enabled: boolean,
    _items: unknown,
    _query: string,
    onSelect: typeof mockOnKeyboardSelect
  ) => {
    mockOnKeyboardSelect = onSelect;
    return { highlightedId: undefined };
  },
}));

const node = (name: string, spec: Partial<ScopeNode['spec']>): ScopeNode => ({
  metadata: { name },
  spec: { title: name, nodeType: 'leaf', linkType: 'scope', linkId: `link-${name}`, parentName: 'parent', ...spec },
});

describe('useScopesHighlighting', () => {
  const toggleExpandedNode = jest.fn();
  const selectScope = jest.fn();
  const deselectScope = jest.fn();

  const render = (scopeNodes: NodesMap, selectedScopes: SelectedScope[] = []) =>
    renderHook(() =>
      useScopesHighlighting({
        selectedNodes: [],
        resultNodes: [],
        treeQuery: '',
        scopeNodes,
        selectedScopes,
        toggleExpandedNode,
        selectScope,
        deselectScope,
      })
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when the parent allows only one selection', () => {
    const scopeNodes = {
      parent: node('parent', {
        nodeType: 'container',
        linkType: undefined,
        linkId: undefined,
        disableMultiSelect: true,
      }),
      leaf: node('leaf', {}),
    };

    it('applies the scope straight away instead of staging it', () => {
      render(scopeNodes);

      mockOnKeyboardSelect('leaf', KeyboardAction.SELECT);

      expect(mockChangeScopes).toHaveBeenCalledWith(['link-leaf'], { scopeNodeId: 'leaf' });
      expect(selectScope).not.toHaveBeenCalled();
      expect(deselectScope).not.toHaveBeenCalled();
    });

    it('stages the scope when the node has no link to apply', () => {
      render({ ...scopeNodes, leaf: node('leaf', { linkId: undefined }) });

      mockOnKeyboardSelect('leaf', KeyboardAction.SELECT);

      expect(mockChangeScopes).not.toHaveBeenCalled();
      expect(selectScope).toHaveBeenCalledWith('leaf');
    });
  });

  describe('when the parent allows several selections', () => {
    const scopeNodes = {
      parent: node('parent', { nodeType: 'container', linkType: undefined, linkId: undefined }),
      leaf: node('leaf', {}),
    };

    it('stages a scope that is not selected yet', () => {
      render(scopeNodes);

      mockOnKeyboardSelect('leaf', KeyboardAction.SELECT);

      expect(selectScope).toHaveBeenCalledWith('leaf');
      expect(mockChangeScopes).not.toHaveBeenCalled();
    });

    it('stages a scope whose parent node has not been loaded', () => {
      render({ leaf: node('leaf', {}) });

      mockOnKeyboardSelect('leaf', KeyboardAction.SELECT);

      expect(selectScope).toHaveBeenCalledWith('leaf');
      expect(mockChangeScopes).not.toHaveBeenCalled();
    });

    it('unstages a scope that is already selected', () => {
      render(scopeNodes, [{ scopeId: 'link-leaf', scopeNodeId: 'leaf' }]);

      mockOnKeyboardSelect('leaf', KeyboardAction.SELECT);

      expect(deselectScope).toHaveBeenCalledWith('leaf');
      expect(selectScope).not.toHaveBeenCalled();
    });
  });

  it('expands a container instead of selecting it', () => {
    render({ container: node('container', { nodeType: 'container', linkType: undefined, linkId: undefined }) });

    mockOnKeyboardSelect('container', KeyboardAction.EXPAND);

    expect(toggleExpandedNode).toHaveBeenCalledWith('container');
    expect(selectScope).not.toHaveBeenCalled();
  });

  it('expands a container that cannot be selected when it is selected with the keyboard', () => {
    render({ container: node('container', { nodeType: 'container', linkType: undefined, linkId: undefined }) });

    mockOnKeyboardSelect('container', KeyboardAction.SELECT);

    expect(toggleExpandedNode).toHaveBeenCalledWith('container');
    expect(selectScope).not.toHaveBeenCalled();
  });

  it('does nothing without a highlighted node', () => {
    render({});

    mockOnKeyboardSelect(undefined, KeyboardAction.SELECT);

    expect(toggleExpandedNode).not.toHaveBeenCalled();
    expect(selectScope).not.toHaveBeenCalled();
    expect(mockChangeScopes).not.toHaveBeenCalled();
  });
});
