import { screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { testWithFeatureToggles } from 'test/test-utils';

import { type Scope, type ScopeNode } from '@grafana/data';

import { ScopesTreeItem } from './ScopesTreeItem';
import { renderWithScopesServices } from './tooltipTestUtils';
import { type NodesMap } from './types';

const scope = (name: string, filters: Scope['spec']['filters'] = []): Scope => ({
  metadata: { name },
  spec: { title: name, filters },
});

const leaf = (name: string, description?: string): ScopeNode => ({
  metadata: { name },
  spec: {
    nodeType: 'leaf',
    title: name,
    description,
    linkType: 'scope',
    linkId: `scope-${name}`,
    parentName: 'category',
  },
});

const category: ScopeNode = {
  metadata: { name: 'category' },
  spec: { nodeType: 'container', title: 'Vault', description: 'Vault clusters', parentName: '' },
};

const leaves = {
  full: leaf('full', 'Production Vault cluster'),
  filtersOnly: leaf('filtersOnly'),
  empty: leaf('empty'),
};
const scopes = [
  scope('scope-full', [{ key: 'cluster', operator: 'equals', value: 'prod' }]),
  scope('scope-filtersOnly', [{ key: 'region', operator: 'regex-match', value: 'us-.*' }]),
  scope('scope-empty'),
];
const nodes = [category, ...Object.values(leaves)];
const scopeNodes: NodesMap = Object.fromEntries(nodes.map((n) => [n.metadata.name, n]));

testWithFeatureToggles({ enable: ['scopeFilters'] });

const renderItem = (scopeNodeId: string, highlighted = false) => {
  const result = renderWithScopesServices(
    <ScopesTreeItem
      anyChildExpanded={false}
      loadingNodeName={undefined}
      treeNode={{ scopeNodeId, expanded: false, query: '' }}
      scopeNodes={scopeNodes}
      selected={false}
      selectedScopes={[]}
      highlighted={highlighted}
    />,
    { scopes, nodes }
  );
  return result;
};

describe('ScopesTreeItem metadata tooltip', () => {
  it('shows the description and the scope filters when hovering a scope', async () => {
    const { user } = renderItem('full');

    await user.hover(screen.getByTestId('scopes-tree-full'));

    expect(await screen.findByText('Production Vault cluster')).toBeInTheDocument();
    expect(screen.getByText('cluster = prod')).toBeInTheDocument();
  });

  it('shows only the filters when the scope node has no description', async () => {
    const { user } = renderItem('filtersOnly');

    await user.hover(screen.getByTestId('scopes-tree-filtersOnly'));

    expect(await screen.findByText('region =~ us-.*')).toBeInTheDocument();
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });

  it('shows no tooltip for a scope without a description or filters', async () => {
    const { user, fetchScope } = renderItem('empty');

    await user.hover(screen.getByTestId('scopes-tree-empty'));

    await waitFor(() => expect(fetchScope).toHaveBeenCalledWith('scope-empty'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows no tooltip for a category, even if it has a description', async () => {
    const { user, fetchScope } = renderItem('category');

    await user.hover(screen.getByTestId('scopes-tree-category'));

    expect(screen.getByText('Vault')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(fetchScope).not.toHaveBeenCalled();
  });

  it('shows the tooltip for the keyboard highlighted scope without hovering', async () => {
    renderItem('full', true);

    expect(await screen.findByText('cluster = prod')).toBeInTheDocument();
  });

  it('hides the tooltip when Escape is pressed', async () => {
    const { user } = renderItem('full');
    await user.hover(screen.getByTestId('scopes-tree-full'));
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows one tooltip at a time when the keyboard highlight moves away from a hovered scope', async () => {
    const itemProps = {
      anyChildExpanded: false,
      loadingNodeName: undefined,
      scopeNodes,
      selected: false,
      selectedScopes: [],
    };
    const Harness = () => {
      const [highlighted, setHighlighted] = useState(false);
      useEffect(() => {
        const onKeyDown = () => setHighlighted(true);
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, []);
      return (
        <>
          <ScopesTreeItem
            {...itemProps}
            treeNode={{ scopeNodeId: 'full', expanded: false, query: '' }}
            highlighted={false}
          />
          <ScopesTreeItem
            {...itemProps}
            treeNode={{ scopeNodeId: 'filtersOnly', expanded: false, query: '' }}
            highlighted={highlighted}
          />
        </>
      );
    };
    const { user } = renderWithScopesServices(<Harness />, { scopes, nodes });
    await user.hover(screen.getByTestId('scopes-tree-full'));
    expect(await screen.findByText('cluster = prod')).toBeInTheDocument();

    await user.keyboard('{ArrowDown}');

    expect(await screen.findByText('region =~ us-.*')).toBeInTheDocument();
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.queryByText('cluster = prod')).not.toBeInTheDocument();
  });

  it('does not let Escape reach ancestors while it dismisses the tooltip', async () => {
    const onKeyDown = jest.fn();
    const { user } = renderWithScopesServices(
      <div onKeyDown={onKeyDown}>
        <ScopesTreeItem
          anyChildExpanded={false}
          loadingNodeName={undefined}
          treeNode={{ scopeNodeId: 'full', expanded: false, query: '' }}
          scopeNodes={scopeNodes}
          selected={false}
          selectedScopes={[]}
          highlighted={false}
        />
      </div>,
      { scopes, nodes }
    );
    await user.tab();
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('does not add a tab stop for the tooltip anchor', () => {
    const { container } = renderItem('full');

    expect(screen.getByTestId('scopes-tree-full')).toBeInTheDocument();
    expect(container.querySelector('[tabindex]')).toBeNull();
  });
});
