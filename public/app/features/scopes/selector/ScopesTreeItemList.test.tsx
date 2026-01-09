import { render, screen } from '@testing-library/react';

import { ScopeNode } from '@grafana/data';

import { ScopesTreeItemList } from './ScopesTreeItemList';
import { NodesMap, SelectedScope, TreeNode } from './types';

// Mock the ScopesContextProvider hook since it requires a full context setup
jest.mock('../ScopesContextProvider', () => ({
  useScopesServices: () => ({
    scopesSelectorService: {
      closeAndApply: jest.fn(),
    },
  }),
}));

describe('ScopesTreeItemList', () => {
  const mockFilterNode = jest.fn();
  const mockSelectScope = jest.fn();
  const mockDeselectScope = jest.fn();
  const mockToggleExpandedNode = jest.fn();

  const defaultProps = {
    anyChildExpanded: false,
    lastExpandedNode: false,
    loadingNodeName: undefined,
    maxHeight: '100%',
    selectedScopes: [] as SelectedScope[],
    filterNode: mockFilterNode,
    selectScope: mockSelectScope,
    deselectScope: mockDeselectScope,
    highlightedId: undefined,
    id: 'test-tree',
    toggleExpandedNode: mockToggleExpandedNode,
  };

  const createMockScopeNode = (name: string, parentName = 'parent'): ScopeNode => ({
    metadata: { name },
    spec: {
      title: `Title ${name}`,
      nodeType: 'leaf',
      linkType: 'scope',
      linkId: `scope-${name}`,
      parentName,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render nothing when items array is empty', () => {
    const { container } = render(<ScopesTreeItemList {...defaultProps} items={[]} scopeNodes={{}} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render tree items when nodes are available', () => {
    const items: TreeNode[] = [
      { scopeNodeId: 'node-1', expanded: false, query: '' },
      { scopeNodeId: 'node-2', expanded: false, query: '' },
    ];

    const scopeNodes: NodesMap = {
      'node-1': createMockScopeNode('node-1'),
      'node-2': createMockScopeNode('node-2'),
      parent: {
        metadata: { name: 'parent' },
        spec: { title: 'Parent', nodeType: 'container', parentName: '' },
      },
    };

    render(<ScopesTreeItemList {...defaultProps} items={items} scopeNodes={scopeNodes} />);

    expect(screen.getByText('Title node-1')).toBeInTheDocument();
    expect(screen.getByText('Title node-2')).toBeInTheDocument();
  });

  it('should skip rendering items when node data is not available in scopeNodes', () => {
    const items: TreeNode[] = [
      { scopeNodeId: 'node-1', expanded: false, query: '' },
      { scopeNodeId: 'missing-node', expanded: false, query: '' }, // This node doesn't exist in scopeNodes
      { scopeNodeId: 'node-2', expanded: false, query: '' },
    ];

    const scopeNodes: NodesMap = {
      'node-1': createMockScopeNode('node-1'),
      'node-2': createMockScopeNode('node-2'),
      parent: {
        metadata: { name: 'parent' },
        spec: { title: 'Parent', nodeType: 'container', parentName: '' },
      },
      // 'missing-node' is intentionally not included
    };

    render(<ScopesTreeItemList {...defaultProps} items={items} scopeNodes={scopeNodes} />);

    // Should render the available nodes
    expect(screen.getByText('Title node-1')).toBeInTheDocument();
    expect(screen.getByText('Title node-2')).toBeInTheDocument();

    // Should NOT crash and should skip the missing node
    expect(screen.queryByText('Title missing-node')).not.toBeInTheDocument();
  });

  it('should handle all items having missing node data gracefully', () => {
    const items: TreeNode[] = [
      { scopeNodeId: 'missing-1', expanded: false, query: '' },
      { scopeNodeId: 'missing-2', expanded: false, query: '' },
    ];

    const scopeNodes: NodesMap = {};

    // Should not crash
    const { container } = render(<ScopesTreeItemList {...defaultProps} items={items} scopeNodes={scopeNodes} />);

    // Container should have the tree div but no visible items rendered inside
    expect(container.querySelector('[role="tree"]')).toBeInTheDocument();
    expect(screen.queryByRole('treeitem')).not.toBeInTheDocument();
  });

  it('should handle empty string scopeNodeId gracefully', () => {
    const items: TreeNode[] = [
      { scopeNodeId: '', expanded: false, query: '' }, // Empty string scopeNodeId
    ];

    const scopeNodes: NodesMap = {};

    // Should not crash
    const { container } = render(<ScopesTreeItemList {...defaultProps} items={items} scopeNodes={scopeNodes} />);

    // Should have tree container but no items
    expect(container.querySelector('[role="tree"]')).toBeInTheDocument();
    expect(screen.queryByRole('treeitem')).not.toBeInTheDocument();
  });
});
