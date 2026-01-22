import { render, screen } from '@testing-library/react';
import { Observable } from 'rxjs';

import { ScopeNode } from '@grafana/data';

import { ScopesTree } from './ScopesTree';
import { NodesMap, SelectedScope, TreeNode } from './types';

const mockScopeNodes: NodesMap = {};
const mockSelectedScopes: SelectedScope[] = [];
const mockLoadingNodeName: string | undefined = undefined;

const mockSelectScope = jest.fn();
const mockDeselectScope = jest.fn();
const mockFilterNode = jest.fn();
const mockToggleExpandedNode = jest.fn();

// Mock the hooks
jest.mock('./useScopesTree', () => ({
  useScopesTree: () => mockScopeNodes,
}));

jest.mock('./useScopeActions', () => ({
  useScopeActions: () => ({
    selectScope: mockSelectScope,
    deselectScope: mockDeselectScope,
    filterNode: mockFilterNode,
    toggleExpandedNode: mockToggleExpandedNode,
  }),
}));

// Mock the ScopesContextProvider hook since it requires a full context setup
jest.mock('../ScopesContextProvider', () => ({
  useScopesServices: () => ({
    scopesSelectorService: {
      closeAndApply: jest.fn(),
      stateObservable: new Observable((subscriber) => {
        subscriber.next({
          loadingNodeName: mockLoadingNodeName,
          selectedScopes: mockSelectedScopes,
        });
      }),
      state: {
        loadingNodeName: mockLoadingNodeName,
        selectedScopes: mockSelectedScopes,
      },
    },
  }),
}));

describe('ScopesTree', () => {
  const createMockScopeNode = (name: string, parentName?: string): ScopeNode => ({
    metadata: { name },
    spec: {
      title: `Title ${name}`,
      nodeType: 'leaf',
      linkType: 'scope',
      linkId: `scope-${name}`,
      parentName: parentName ?? '',
    },
  });

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

  const defaultProps = {
    tree: defaultTree,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock values before each test
    Object.assign(mockScopeNodes, defaultScopeNodes);
    mockSelectedScopes.length = 0;
  });

  describe('selectedNodesToShow logic', () => {
    it('should not show selectedNodesToShow when no scopes are selected', () => {
      render(<ScopesTree {...defaultProps} />);

      // Both child-1 and child-2 should be visible in the regular children list
      expect(screen.getByText('Title child-1')).toBeInTheDocument();
      expect(screen.getByText('Title child-2')).toBeInTheDocument();
    });

    it('should only consider first selected scope for selectedNodesToShow', () => {
      // Set mock selected scopes
      mockSelectedScopes.push(
        { scopeId: 'scope-1', scopeNodeId: 'child-1' },
        { scopeId: 'scope-2', scopeNodeId: 'child-2' }
      );

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

      render(<ScopesTree {...defaultProps} tree={tree} />);

      // child-1 should be shown (from selectedNodesToShow - only first scope is considered)
      expect(screen.getByText('Title child-1')).toBeInTheDocument();
      // child-2 should also be shown (from regular children)
      expect(screen.getByText('Title child-2')).toBeInTheDocument();
    });

    it('should not show selectedNodesToShow when first scope has no scopeNodeId', () => {
      const selectedScopes: SelectedScope[] = [
        { scopeId: 'scope-1', scopeNodeId: undefined }, // No scopeNodeId
        { scopeId: 'scope-2', scopeNodeId: 'child-2' },
      ];

      // Tree with no children to make it obvious if selectedNodesToShow is populated
      const tree: TreeNode = {
        scopeNodeId: 'parent-container',
        expanded: true,
        query: '',
        children: {},
        childrenLoaded: true,
      };

      render(<ScopesTree {...defaultProps} tree={tree} selectedScopes={selectedScopes} />);

      // child-2 should NOT appear because only first scope is considered and it has no scopeNodeId
      expect(screen.queryByText('Title child-2')).not.toBeInTheDocument();
    });

    it('should not show selectedNodesToShow when first scope node is not in scopeNodes cache', () => {
      const selectedScopes: SelectedScope[] = [
        { scopeId: 'scope-1', scopeNodeId: 'missing-node' }, // Node not in scopeNodes
        { scopeId: 'scope-2', scopeNodeId: 'child-2' },
      ];

      // Tree with no children
      const tree: TreeNode = {
        scopeNodeId: 'parent-container',
        expanded: true,
        query: '',
        children: {},
        childrenLoaded: true,
      };

      render(<ScopesTree {...defaultProps} tree={tree} selectedScopes={selectedScopes} />);

      // Neither should appear since first scope's node is missing from cache
      expect(screen.queryByText('Title missing-node')).not.toBeInTheDocument();
      expect(screen.queryByText('Title child-2')).not.toBeInTheDocument();
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

      // child-1 should NOT appear since tree's scopeNodeId doesn't match child-1's parent
      expect(screen.queryByText('Title child-1')).not.toBeInTheDocument();
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

      // child-1 should appear exactly once (in regular children, not duplicated)
      const child1Elements = screen.getAllByText('Title child-1');
      expect(child1Elements).toHaveLength(1);
    });
  });

  describe('graceful handling of missing data', () => {
    it('should not crash when scopeNodes is empty', () => {
      const tree: TreeNode = {
        scopeNodeId: '',
        expanded: true,
        query: '',
        children: {},
        childrenLoaded: true,
      };

      render(<ScopesTree {...defaultProps} tree={tree} scopeNodes={{}} />);

      // Should render without crashing - search input should be present
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should handle tree with children referencing missing nodes', () => {
      const tree: TreeNode = {
        scopeNodeId: 'parent-container',
        expanded: true,
        query: '',
        children: {
          'existing-node': { scopeNodeId: 'existing-node', expanded: false, query: '' },
          'missing-node': { scopeNodeId: 'missing-node', expanded: false, query: '' },
        },
        childrenLoaded: true,
      };

      const scopeNodes: NodesMap = {
        'parent-container': {
          metadata: { name: 'parent-container' },
          spec: { title: 'Parent', nodeType: 'container', parentName: '' },
        },
        'existing-node': createMockScopeNode('existing-node', 'parent-container'),
        // 'missing-node' intentionally not included
      };

      // Should render without crashing
      render(<ScopesTree {...defaultProps} tree={tree} scopeNodes={scopeNodes} />);

      // Existing node should be rendered
      expect(screen.getByText('Title existing-node')).toBeInTheDocument();
      // Missing node should be gracefully skipped
      expect(screen.queryByText('Title missing-node')).not.toBeInTheDocument();
    });
  });
});
