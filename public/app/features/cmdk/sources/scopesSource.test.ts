import { Observable } from 'rxjs';

import { type ScopeNode } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type ScopesSelectorServiceState } from 'app/features/scopes/selector/ScopesSelectorService';
import { type TreeNode } from 'app/features/scopes/selector/types';

import { type CmdkItem, type CmdkItemAction } from '../types';

import { createScopesRootSource, createScopeTreeSource, type ScopesSelectorLike } from './scopesSource';

function scopeNode(name: string, nodeType: 'leaf' | 'container', parentName?: string): ScopeNode {
  return { metadata: { name }, spec: { title: `${name} title`, nodeType, parentName, linkId: `link-${name}` } };
}

function treeNode(scopeNodeId: string, children?: Record<string, TreeNode>): TreeNode {
  return { scopeNodeId, expanded: true, query: '', children };
}

function makeState(partial: Partial<ScopesSelectorServiceState> = {}): ScopesSelectorServiceState {
  return {
    loading: false,
    loadingNodeName: undefined,
    opened: false,
    nodes: {},
    scopes: {},
    selectedScopes: [],
    appliedScopes: [],
    tree: treeNode(''),
    ...partial,
  };
}

function makeSelector(state: ScopesSelectorServiceState): ScopesSelectorLike {
  return {
    state,
    stateObservable: new Observable(),
    filterNode: jest.fn().mockResolvedValue(undefined),
    selectScope: jest.fn().mockResolvedValue(undefined),
    deselectScope: jest.fn().mockResolvedValue(undefined),
    resetSelection: jest.fn(),
    apply: jest.fn(),
    changeScopes: jest.fn(),
    searchAllNodes: jest.fn().mockResolvedValue([]),
    getScopeNodes: jest.fn().mockResolvedValue([]),
  };
}

const signal = () => new AbortController().signal;

function expectItem(items: CmdkItem[], id: string): CmdkItem {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Expected item with id ${id}, got ${items.map((candidate) => candidate.id).join(', ')}`);
  }
  return item;
}

describe('createScopeTreeSource', () => {
  function makeTreeSelector() {
    return makeSelector(
      makeState({
        nodes: {
          group: scopeNode('group', 'container'),
          leaf: scopeNode('leaf', 'leaf', 'group'),
          selected: scopeNode('selected', 'leaf'),
        },
        selectedScopes: [{ scopeId: 'link-selected', scopeNodeId: 'selected' }],
        tree: treeNode('', {
          group: treeNode('group', { leaf: treeNode('leaf') }),
          selected: treeNode('selected'),
        }),
      })
    );
  }

  it('lets the scope service filter and maps the level to items', async () => {
    const selector = makeTreeSelector();
    const source = createScopeTreeSource(selector);

    const items = await source.query('some query', signal());

    expect(selector.filterNode).toHaveBeenCalledWith('', 'some query');
    // Container becomes a subscope, selected leaf is hidden (it shows in the header row)
    expect(items.map((item) => [item.id, item.type])).toEqual([['scopes/group', 'subscope']]);
  });

  it('selects a scope through a keepOpen action', async () => {
    const selector = makeTreeSelector();
    const source = createScopeTreeSource(selector, scopeNode('group', 'container'));

    const items = await source.query('', signal());
    expect(selector.filterNode).toHaveBeenCalledWith('group', '');

    const leaf = expectItem(items, 'scopes/leaf');
    if (leaf.type !== 'action') {
      throw new Error(`Expected action item, got ${leaf.type}`);
    }
    expect(leaf.keepOpen).toBe(true);
    expect(leaf.subtitle).toBe('group title');

    leaf.action();
    expect(selector.selectScope).toHaveBeenCalledWith('leaf');
  });

  it('drills deeper through subscopes', async () => {
    const selector = makeTreeSelector();
    const source = createScopeTreeSource(selector);

    const items = await source.query('', signal());
    const group = expectItem(items, 'scopes/group');
    if (group.type !== 'subscope') {
      throw new Error(`Expected subscope item, got ${group.type}`);
    }

    const groupScope = group.getScope();
    expect(groupScope.subscopeName).toBe('group title');

    const groupItems = await groupScope.query('', signal());
    expect(expectItem(groupItems, 'scopes/leaf')).toBeDefined();
  });
});

describe('createScopesRootSource', () => {
  const recentItem: CmdkItemAction = {
    type: 'action',
    id: 'recent-scopes/scope-a',
    sectionId: 'recent-scopes',
    title: 'Scope A',
    priority: 50,
    action: jest.fn(),
  };
  const recentEntry = { item: recentItem, searchText: 'Scope A scope-a' };

  afterEach(() => {
    config.featureToggles.scopeSearchAllLevels = false;
  });

  it('shows recent scopes and the scopes entry point for the empty query', async () => {
    const selector = makeSelector(makeState());
    const source = createScopesRootSource(selector, () => [recentEntry]);

    const items = await source.query('', signal());

    expect(items.map((item) => item.id)).toEqual(['recent-scopes/scope-a', 'scopes']);
  });

  it('fuzzy-filters recent scopes when typing', async () => {
    const selector = makeSelector(makeState());
    const source = createScopesRootSource(selector, () => [recentEntry]);

    expect((await source.query('scope a', signal())).map((item) => item.id)).toContain('recent-scopes/scope-a');
    expect((await source.query('unrelated', signal())).map((item) => item.id)).not.toContain(
      'recent-scopes/scope-a'
    );
  });

  it('searches all levels when the toggle is on, only showing leaf nodes with their parent title', async () => {
    config.featureToggles.scopeSearchAllLevels = true;
    const selector = makeSelector(makeState());
    jest.mocked(selector.searchAllNodes).mockResolvedValue([scopeNode('leaf', 'leaf', 'parent'), scopeNode('category', 'container')]);
    jest.mocked(selector.getScopeNodes).mockResolvedValue([scopeNode('parent', 'container')]);

    const source = createScopesRootSource(selector, () => []);
    const items = await source.query('leaf', signal());

    expect(selector.searchAllNodes).toHaveBeenCalledWith('leaf', 10);
    const leaf = expectItem(items, 'scopes/leaf');
    expect(leaf.subtitle).toBe('parent title');
    expect(items.map((item) => item.id)).not.toContain('scopes/category');
  });

  it('does not search all levels for the empty query', async () => {
    config.featureToggles.scopeSearchAllLevels = true;
    const selector = makeSelector(makeState());

    await createScopesRootSource(selector, () => []).query('', signal());

    expect(selector.searchAllNodes).not.toHaveBeenCalled();
  });
});
