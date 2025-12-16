import { render, screen } from '@testing-library/react';

import { ScopeNode } from '@grafana/data';

import { ScopesTree } from './ScopesTree';
import { NodesMap, SelectedScope, TreeNode } from './types';

// Mock child components to simplify testing
jest.mock('./ScopesTreeSearch', () => ({
  ScopesTreeSearch: () => <div data-testid="scopes-tree-search">Search</div>,
}));

jest.mock('./ScopesTreeHeadline', () => ({
  ScopesTreeHeadline: () => <div data-testid="scopes-tree-headline">Headline</div>,
}));

jest.mock('./ScopesTreeItemList', () => ({
  ScopesTreeItemList: ({ items, id }: { items: TreeNode[]; id: string }) => (
    <div data-testid={`item-list-${id}`}>
      {items.map((item) => (
        <div key={item.scopeNodeId} data-testid={`item-${item.scopeNodeId}`}>
          {item.scopeNodeId}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./RecentScopes', () => ({
  RecentScopes: () => <div data-testid="recent-scopes">Recent Scopes</div>,
}));

jest.mock('./useScopesHighlighting', () => ({
  useScopesHighlighting: () => ({
    highlightedId: undefined,
    ariaActiveDescendant: undefined,
    enableHighlighting: jest.fn(),
    disableHighlighting: jest.fn(),
  }),
}));

describe('ScopesTree', () => {
  const mockFilterNode = jest.fn();
  const mockSelectScope = jest.fn();
  const mockDeselectScope = jest.fn();
  const mockToggleExpandedNode = jest.fn();

  const createMockScopeNode = (name: string, parentName?: string): ScopeNode => ({
    metadata: { name },
    spec: {
      title: name,
      nodeType: 'leaf',
      linkType: 'scope',
      linkId: `scope-${name}`,
      parentName: parentName ?? '',
    },
  });

  const defaultTree: TreeNode = {
    scopeNodeId: 'parent-container',
    expanded: true,
    query: '',
    children: {
      'child-1': { scopeNodeId: 'child-1', expanded: false, query: '' },
      'child-2': { scopeNodeId: 'child-2', expanded: false, query: '' },
    },
    childrenLoaded: true,
  };

  const defaultScopeNodes: NodesMap = {
    'parent-container': {
      metadata: { name: 'parent-container' },
      spec: {
        title: 'Parent Container',
        nodeType: 'container',
        parentName: '',
      },
    },
    'child-1': createMockScopeNode('child-1', 'parent-container'),
    'child-2': createMockScopeNode('child-2', 'parent-container'),
  };

  const defaultProps = {
    tree: defaultTree,
    loadingNodeName: undefined,
    selectedScopes: [] as SelectedScope[],
    scopeNodes: defaultScopeNodes,
    filterNode: mockFilterNode,
    selectScope: mockSelectScope,
    deselectScope: mockDeselectScope,
    toggleExpandedNode: mockToggleExpandedNode,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('selectedNodesToShow logic', () => {
    it('should not show selectedNodesToShow when no scopes are selected', () => {
      render(<ScopesTree {...defaultProps} selectedScopes={[]} />);

      // The first ScopesTreeItemList (for selectedNodesToShow) should be empty
      const itemLists = screen.getAllByTestId(/^item-list-/);
      expect(itemLists.length).toBe(2);
      // First list should have no items
      expect(itemLists[0].children.length).toBe(0);
    });

    it('should only consider first selected scope for selectedNodesToShow', () => {
      const selectedScopes: SelectedScope[] = [
        { scopeId: 'scope-1', scopeNodeId: 'child-1' },
        { scopeId: 'scope-2', scopeNodeId: 'child-2' },
      ];

      // Use a tree where child-1 is NOT in the children (to trigger selectedNodesToShow)
      const tree: TreeNode = {
        scopeNodeId: 'parent-container',
        expanded: true,
        query: '',
        children: {
          // child-1 is NOT here, so it should appear in selectedNodesToShow
          'child-2': { scopeNodeId: 'child-2', expanded: false, query: '' },
        },
        childrenLoaded: true,
      };

      render(<ScopesTree {...defaultProps} tree={tree} selectedScopes={selectedScopes} />);

      // First ScopesTreeItemList (selectedNodesToShow) should only have child-1 (the first selected scope)
      // NOT child-2 (the second selected scope)
      const itemLists = screen.getAllByTestId(/^item-list-/);
      expect(itemLists[0].children.length).toBe(1);
      expect(screen.getByTestId('item-child-1')).toBeInTheDocument();
    });

    it('should not show selectedNodesToShow when first scope has no scopeNodeId', () => {
      const selectedScopes: SelectedScope[] = [
        { scopeId: 'scope-1', scopeNodeId: undefined }, // No scopeNodeId
        { scopeId: 'scope-2', scopeNodeId: 'child-2' },
      ];

      render(<ScopesTree {...defaultProps} selectedScopes={selectedScopes} />);

      // First ScopesTreeItemList (selectedNodesToShow) should be empty
      const itemLists = screen.getAllByTestId(/^item-list-/);
      expect(itemLists[0].children.length).toBe(0);
    });

    it('should not show selectedNodesToShow when first scope node is not in scopeNodes cache', () => {
      const selectedScopes: SelectedScope[] = [
        { scopeId: 'scope-1', scopeNodeId: 'missing-node' }, // Node not in scopeNodes
        { scopeId: 'scope-2', scopeNodeId: 'child-2' },
      ];

      render(<ScopesTree {...defaultProps} selectedScopes={selectedScopes} />);

      // First ScopesTreeItemList (selectedNodesToShow) should be empty
      const itemLists = screen.getAllByTestId(/^item-list-/);
      expect(itemLists[0].children.length).toBe(0);
    });

    it('should not show selectedNodesToShow when tree scopeNodeId does not match first scope parent', () => {
      const selectedScopes: SelectedScope[] = [
        { scopeId: 'scope-1', scopeNodeId: 'child-1' }, // child-1's parent is 'parent-container'
      ];

      // Tree with different scopeNodeId
      const tree: TreeNode = {
        scopeNodeId: 'different-container', // Different from child-1's parent
        expanded: true,
        query: '',
        children: {},
        childrenLoaded: true,
      };

      const scopeNodes: NodesMap = {
        ...defaultScopeNodes,
        'different-container': {
          metadata: { name: 'different-container' },
          spec: { title: 'Different', nodeType: 'container', parentName: '' },
        },
      };

      render(<ScopesTree {...defaultProps} tree={tree} scopeNodes={scopeNodes} selectedScopes={selectedScopes} />);

      // First ScopesTreeItemList (selectedNodesToShow) should be empty
      const itemLists = screen.getAllByTestId(/^item-list-/);
      expect(itemLists[0].children.length).toBe(0);
    });

    it('should not duplicate scope in selectedNodesToShow if already in children', () => {
      const selectedScopes: SelectedScope[] = [{ scopeId: 'scope-1', scopeNodeId: 'child-1' }];

      // Tree already has child-1 in children
      const tree: TreeNode = {
        scopeNodeId: 'parent-container',
        expanded: true,
        query: '',
        children: {
          'child-1': { scopeNodeId: 'child-1', expanded: false, query: '' },
          'child-2': { scopeNodeId: 'child-2', expanded: false, query: '' },
        },
        childrenLoaded: true,
      };

      render(<ScopesTree {...defaultProps} tree={tree} selectedScopes={selectedScopes} />);

      // First ScopesTreeItemList (selectedNodesToShow) should be empty since child-1 is already in children
      const itemLists = screen.getAllByTestId(/^item-list-/);
      expect(itemLists[0].children.length).toBe(0);

      // child-1 should appear in the second list (regular children)
      expect(itemLists[1].children.length).toBe(2);
    });
  });

  describe('graceful handling of missing data', () => {
    it('should not crash when scopeNodes is empty', () => {
      render(<ScopesTree {...defaultProps} scopeNodes={{}} />);

      // Should render without crashing
      expect(screen.getByTestId('scopes-tree-search')).toBeInTheDocument();
    });

    it('should handle tree with children referencing missing nodes', () => {
      const tree: TreeNode = {
        scopeNodeId: 'parent',
        expanded: true,
        query: '',
        children: {
          'existing-node': { scopeNodeId: 'existing-node', expanded: false, query: '' },
          'missing-node': { scopeNodeId: 'missing-node', expanded: false, query: '' },
        },
        childrenLoaded: true,
      };

      const scopeNodes: NodesMap = {
        parent: {
          metadata: { name: 'parent' },
          spec: { title: 'Parent', nodeType: 'container', parentName: '' },
        },
        'existing-node': createMockScopeNode('existing-node', 'parent'),
        // 'missing-node' intentionally not included
      };

      // Should render without crashing
      render(<ScopesTree {...defaultProps} tree={tree} scopeNodes={scopeNodes} />);

      expect(screen.getByTestId('scopes-tree-search')).toBeInTheDocument();
    });
  });
});
