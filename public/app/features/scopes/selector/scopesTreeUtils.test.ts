import { ScopeNode } from '@grafana/data';

import {
  closeNodes,
  expandNodes,
  isNodeExpandable,
  isNodeSelectable,
  getPathOfNode,
  modifyTreeNodeAtPath,
  treeNodeAtPath,
} from './scopesTreeUtils';
import { TreeNode, NodesMap } from './types';

describe('scopesTreeUtils', () => {
  describe('closeNodes', () => {
    it('should create a deep copy with all nodes closed', () => {
      const tree: TreeNode = {
        expanded: true,
        scopeNodeId: 'root',
        query: '',
        children: {
          child1: {
            expanded: true,
            scopeNodeId: 'child1',
            query: '',
            children: {
              grandchild1: {
                expanded: true,
                scopeNodeId: 'grandchild1',
                query: '',
              },
            },
          },
        },
      };

      const result = closeNodes(tree);

      expect(result.expanded).toBe(false);
      expect(result.children?.child1.expanded).toBe(false);
      expect(result.children?.child1.children?.grandchild1.expanded).toBe(false);
      // Verify it's a deep copy
      expect(result).not.toBe(tree);
      expect(result.children).not.toBe(tree.children);
    });
  });

  describe('expandNodes', () => {
    it('should expand nodes along the specified path', () => {
      const tree: TreeNode = {
        expanded: false,
        scopeNodeId: 'root',
        query: '',
        children: {
          child1: {
            expanded: false,
            scopeNodeId: 'child1',
            query: '',
            children: {
              grandchild1: {
                expanded: false,
                scopeNodeId: 'grandchild1',
                query: '',
              },

              grandchild2: {
                expanded: false,
                scopeNodeId: 'grandchild2',
                query: '',
              },
            },
          },
        },
      };

      const path = ['', 'child1', 'grandchild1'];
      const result = expandNodes(tree, path);

      expect(result.expanded).toBe(true);
      expect(result.children?.child1.expanded).toBe(true);
      expect(result.children?.child1.children?.grandchild1.expanded).toBe(true);
      // Other nodes don't get expanded
      expect(result.children?.child1.children?.grandchild2.expanded).toBe(false);
    });

    it('should throw error when path contains non-existent node', () => {
      const tree: TreeNode = {
        expanded: false,
        scopeNodeId: 'root',
        query: '',
        children: {},
      };

      expect(() => expandNodes(tree, ['', 'nonexistent'])).toThrow('Node nonexistent not found in tree');
    });
  });

  describe('isNodeExpandable', () => {
    it('should return true for container nodes', () => {
      const node = { spec: { nodeType: 'container' } } as ScopeNode;
      expect(isNodeExpandable(node)).toBe(true);
    });

    it('should return false for non-container nodes', () => {
      const node = { spec: { nodeType: 'leaf' } } as ScopeNode;
      expect(isNodeExpandable(node)).toBe(false);
    });
  });

  describe('isNodeSelectable', () => {
    it('should return true for scope nodes', () => {
      const node = { spec: { linkType: 'scope' } } as ScopeNode;
      expect(isNodeSelectable(node)).toBe(true);
    });

    it('should return false for non-scope nodes', () => {
      const node = { spec: { linkType: undefined } } as ScopeNode;
      expect(isNodeSelectable(node)).toBe(false);
    });
  });

  describe('getPathOfNode', () => {
    it('should return correct path for nested node', () => {
      const nodes: NodesMap = {
        root: { spec: { parentName: '' } } as ScopeNode,
        child: { spec: { parentName: 'root' } } as ScopeNode,
        grandchild: { spec: { parentName: 'child' } } as ScopeNode,
      };

      const path = getPathOfNode('grandchild', nodes);
      expect(path).toEqual(['', 'root', 'child', 'grandchild']);
    });
  });

  describe('modifyTreeNodeAtPath', () => {
    it('should modify node at specified path', () => {
      const tree: TreeNode = {
        expanded: false,
        scopeNodeId: 'root',
        query: '',
        children: {
          child1: {
            expanded: false,
            scopeNodeId: 'child1',
            query: '',
          },
        },
      };

      const result = modifyTreeNodeAtPath(tree, ['', 'child1'], (node) => {
        node.expanded = true;
        node.query = 'test';
      });

      expect(result.children?.child1.expanded).toBe(true);
      expect(result.children?.child1.query).toBe('test');
    });

    it('should return original tree if path is invalid', () => {
      const tree: TreeNode = {
        expanded: false,
        scopeNodeId: 'root',
        query: '',
        children: {},
      };

      const result = modifyTreeNodeAtPath(tree, ['', 'nonexistent'], (node) => {
        node.expanded = true;
      });

      expect(result).toEqual(tree);
    });
  });

  describe('treeNodeAtPath', () => {
    it('should return node at specified path', () => {
      const tree: TreeNode = {
        expanded: false,
        scopeNodeId: 'root',
        query: '',
        children: {
          child1: {
            expanded: false,
            scopeNodeId: 'child1',
            query: '',
          },
        },
      };

      const result = treeNodeAtPath(tree, ['', 'child1']);
      expect(result).toBe(tree.children?.child1);
    });

    it('should return undefined for invalid path', () => {
      const tree: TreeNode = {
        expanded: false,
        scopeNodeId: 'root',
        query: '',
        children: {},
      };

      const result = treeNodeAtPath(tree, ['', 'nonexistent']);
      expect(result).toBeUndefined();
    });
  });
});
