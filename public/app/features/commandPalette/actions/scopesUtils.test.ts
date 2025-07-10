import { setIn } from 'immutable';

import { ScopeNode } from '@grafana/data';

import { NodesMap, SelectedScope, TreeNode } from '../../scopes/selector/types';
import { SCOPES_PRIORITY } from '../values';

import { mapScopeNodeToAction, mapScopesNodesTreeToActions } from './scopesUtils';

const scopeNode: ScopeNode = {
  metadata: { name: 'scope1' },
  spec: {
    title: 'Scope 1',
    nodeType: 'leaf',
    linkId: 'link1',
    parentName: 'Parent Scope',
  },
};

describe('mapScopeNodeToAction', () => {
  const mockSelectScope = jest.fn();

  it('should map a leaf scope node to an action with a parent', () => {
    const action = mapScopeNodeToAction(scopeNode, mockSelectScope, 'parent1');

    expect(action).toEqual({
      id: 'parent1/scope1',
      name: 'Scope 1',
      keywords: 'Scope 1 scope1',
      priority: SCOPES_PRIORITY,
      parent: 'parent1',
      perform: expect.any(Function),
    });
  });

  it('should map a non-leaf scope node to an action with a parent (without perform)', () => {
    const nonLeafScopeNode = setIn(scopeNode, ['spec', 'nodeType'], 'container');
    const action = mapScopeNodeToAction(nonLeafScopeNode, mockSelectScope, 'parent1');

    expect(action).toEqual({
      id: 'parent1/scope1',
      name: 'Scope 1',
      keywords: 'Scope 1 scope1',
      priority: SCOPES_PRIORITY,
      parent: 'parent1',
    });

    // Non-leaf nodes don't have a perform function
    expect(action.perform).toBeUndefined();
  });

  it('should map a scope node to an action without a parent', () => {
    const action = mapScopeNodeToAction(scopeNode, mockSelectScope);

    expect(action).toEqual({
      id: 'scopes/scope1',
      name: 'Scope 1',
      keywords: 'Scope 1 scope1',
      priority: SCOPES_PRIORITY,
      section: 'Scopes',
      subtitle: 'Parent Scope',
      perform: expect.any(Function),
    });
  });
});

const nodes: NodesMap = {
  scope1: {
    metadata: { name: 'scope1' },
    spec: {
      title: 'Scope 1',
      nodeType: 'leaf',
      linkId: 'link1',
      parentName: '',
    },
  },
  scope2: {
    metadata: { name: 'scope2' },
    spec: {
      title: 'Scope 2',
      nodeType: 'leaf',
      linkId: 'link2',
      parentName: '',
    },
  },
  scope3: {
    metadata: { name: 'scope3' },
    spec: {
      title: 'Scope 3',
      nodeType: 'container',
      linkId: 'link3',
      parentName: '',
    },
  },
  scope4: {
    metadata: { name: 'scope4' },
    spec: {
      title: 'Scope 4',
      nodeType: 'leaf',
      linkId: 'link4',
      parentName: 'Scope 3',
    },
  },
};

const tree: TreeNode = {
  scopeNodeId: 'root',
  expanded: true,
  query: '',
  children: {
    scope1: { scopeNodeId: 'scope1', expanded: false, children: {}, query: '' },
    scope2: { scopeNodeId: 'scope2', expanded: false, children: {}, query: '' },
    scope3: {
      scopeNodeId: 'scope3',
      expanded: true,
      query: '',
      children: {
        scope4: { scopeNodeId: 'scope4', expanded: false, children: {}, query: '' },
      },
    },
  },
};

describe('mapScopesNodesTreeToActions', () => {
  const mockSelectScope = jest.fn();

  it('should map tree nodes to actions and skip selected scopes', () => {
    const selectedScopes: SelectedScope[] = [{ scopeNodeId: 'scope2', scopeId: 'link2' }];
    const actions = mapScopesNodesTreeToActions(nodes, tree, selectedScopes, mockSelectScope);

    // We expect 4 actions: the parent action + scope1 + scope3 + scope4
    // scope2 should be skipped because it's selected
    expect(actions).toHaveLength(4);

    // Verify parent action is first
    expect(actions[0].id).toBe('scopes');

    // Verify scope1 action
    expect(actions.find((a) => a.id === 'scopes/scope1')).toBeTruthy();

    // Verify scope2 is skipped (it's selected)
    expect(actions.find((a) => a.id === 'scopes/scope2')).toBeFalsy();

    const scope3Action = actions.find((a) => a.id === 'scopes/scope3');
    expect(scope3Action).toBeTruthy();
    expect(scope3Action?.perform).toBeUndefined(); // No perform for branch nodes

    // Verify scope4 action (child of scope3)
    const scope4Action = actions.find((a) => a.id === 'scopes/scope3/scope4');
    expect(scope4Action).toBeTruthy();
    expect(scope4Action?.perform).toBeDefined();
  });

  it('should skip selected scopes if we only have scopeId of selected scope', () => {
    const selectedScopes: SelectedScope[] = [{ scopeId: 'link2' }];
    const actions = mapScopesNodesTreeToActions(nodes, tree, selectedScopes, mockSelectScope);
    expect(actions.find((a) => a.id === 'scopes/scope2')).toBeFalsy();
  });

  it('should handle empty tree children', () => {
    const nodes: NodesMap = {};
    const tree: TreeNode = {
      scopeNodeId: 'root',
      expanded: true,
      children: {},
      query: '',
    };
    const selectedScopes: SelectedScope[] = [];
    const actions = mapScopesNodesTreeToActions(nodes, tree, selectedScopes, mockSelectScope);

    // Only the parent action
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('scopes');
  });

  it('should handle undefined children', () => {
    const nodes: NodesMap = {};
    const tree: TreeNode = {
      scopeNodeId: 'root',
      expanded: true,
      children: undefined,
      query: '',
    };
    const selectedScopes: SelectedScope[] = [];
    const actions = mapScopesNodesTreeToActions(nodes, tree, selectedScopes, mockSelectScope);

    // Only the parent action
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('scopes');
  });
});
