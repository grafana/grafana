import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type Scope, type ScopeNode } from '@grafana/data';

import { ScopesTreeItem } from './ScopesTreeItem';
import { type NodesMap } from './types';

const mockGetScope = jest.fn<Promise<Scope | undefined>, [string]>();

jest.mock('../ScopesContextProvider', () => ({
  useScopesServices: () => ({
    scopesSelectorService: { closeAndApply: jest.fn(), getScope: (id: string) => mockGetScope(id) },
  }),
}));

jest.mock('./useScopeActions', () => ({
  useScopeActions: () => ({ selectScope: jest.fn(), deselectScope: jest.fn(), toggleExpandedNode: jest.fn() }),
}));

const leaf: ScopeNode = {
  metadata: { name: 'leaf' },
  spec: {
    nodeType: 'leaf',
    title: 'prod-us-central-0',
    description: 'Production Vault cluster',
    linkType: 'scope',
    linkId: 'scope-leaf',
    parentName: 'category',
  },
};

const category: ScopeNode = {
  metadata: { name: 'category' },
  spec: { nodeType: 'container', title: 'Vault', description: 'Vault clusters', parentName: '' },
};

const scopeNodes: NodesMap = { leaf, category };

const renderItem = (scopeNodeId: string) =>
  render(
    <ScopesTreeItem
      anyChildExpanded={false}
      loadingNodeName={undefined}
      treeNode={{ scopeNodeId, expanded: false, query: '' }}
      scopeNodes={scopeNodes}
      selected={false}
      selectedScopes={[]}
      highlighted={false}
    />
  );

describe('ScopesTreeItem metadata tooltip', () => {
  beforeEach(() => {
    mockGetScope.mockReset();
    mockGetScope.mockResolvedValue({
      metadata: { name: 'scope-leaf' },
      spec: {
        title: 'prod-us-central-0',
        filters: [{ key: 'cluster', operator: 'equals', value: 'prod-us-central-0' }],
      },
    });
  });

  it('shows the description and the scope filters when hovering a scope', async () => {
    const { user } = renderItem('leaf');

    await user.hover(screen.getByTestId('scopes-tree-leaf'));

    expect(await screen.findByText('Production Vault cluster')).toBeInTheDocument();
    expect(await screen.findByText('cluster = prod-us-central-0')).toBeInTheDocument();
    expect(mockGetScope).toHaveBeenCalledWith('scope-leaf');
  });

  it('does not show a tooltip when hovering a category, even if it has a description', async () => {
    const { user } = renderItem('category');

    await user.hover(screen.getByTestId('scopes-tree-category'));

    expect(screen.getByText('Vault')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText('Vault clusters')).not.toBeInTheDocument();
    expect(mockGetScope).not.toHaveBeenCalled();
  });
});
