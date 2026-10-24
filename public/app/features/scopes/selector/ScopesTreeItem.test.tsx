import { screen, waitFor, within } from '@testing-library/react';
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

const singleSelectCategory: ScopeNode = {
  metadata: { name: 'single' },
  spec: { nodeType: 'container', title: 'Single', parentName: '', disableMultiSelect: true },
};

const leaves = {
  full: leaf('full', 'Production Vault cluster'),
  filtersOnly: leaf('filtersOnly'),
  empty: leaf('empty'),
  singleSelect: { ...leaf('singleSelect'), spec: { ...leaf('singleSelect').spec, parentName: 'single' } },
  unlinked: {
    metadata: { name: 'unlinked' },
    spec: { nodeType: 'leaf' as const, title: 'unlinked', parentName: 'category' },
  },
};
const scopes = [
  scope('scope-full', [{ key: 'cluster', operator: 'equals', value: 'prod' }]),
  scope('scope-filtersOnly', [{ key: 'region', operator: 'regex-match', value: 'us-.*' }]),
  scope('scope-empty'),
  scope('scope-singleSelect', [{ key: 'tier', operator: 'equals', value: 'gold' }]),
];
const nodes = [category, singleSelectCategory, ...Object.values(leaves)];
const scopeNodes: NodesMap = Object.fromEntries(nodes.map((n) => [n.metadata.name, n]));

testWithFeatureToggles({ enable: ['scopeFilters'] });

const item = (scopeNodeId: string, highlighted = false) => (
  <ScopesTreeItem
    anyChildExpanded={false}
    loadingNodeName={undefined}
    treeNode={{ scopeNodeId, expanded: false, query: '' }}
    scopeNodes={scopeNodes}
    selected={false}
    selectedScopes={[]}
    highlighted={highlighted}
  />
);

const renderItem = (scopeNodeId: string, highlighted = false) =>
  renderWithScopesServices(item(scopeNodeId, highlighted), { scopes, nodes });

const tooltip = async () => within(await screen.findByRole('tooltip'));

describe('ScopesTreeItem metadata tooltip', () => {
  it('shows the description and the scope filters when hovering a scope', async () => {
    const { user } = renderItem('full');

    await user.hover(screen.getByTestId('scopes-tree-full'));

    expect(await (await tooltip()).findByText('Production Vault cluster')).toBeInTheDocument();
    expect(within(screen.getByRole('tooltip')).getByText('cluster = prod')).toBeInTheDocument();
  });

  it('shows only the filters when the scope node has no description', async () => {
    const { user } = renderItem('filtersOnly');

    await user.hover(screen.getByTestId('scopes-tree-filtersOnly'));

    expect(await (await tooltip()).findByText('region =~ us-.*')).toBeInTheDocument();
    expect(within(screen.getByRole('tooltip')).queryByText('Description')).not.toBeInTheDocument();
  });

  it('shows the tooltip for a scope in a category that does not allow multi select', async () => {
    const { user } = renderItem('singleSelect');

    await user.hover(screen.getByTestId('scopes-tree-singleSelect'));

    expect(await (await tooltip()).findByText('tier = gold')).toBeInTheDocument();
  });

  it('shows no tooltip and no description reference for a scope without a description or filters', async () => {
    const { user, fetchScope } = renderItem('empty', true);

    await user.hover(screen.getByTestId('scopes-tree-empty'));

    await waitFor(() => expect(fetchScope).toHaveBeenCalledWith('scope-empty'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('treeitem')).not.toHaveAttribute('aria-describedby');
  });

  it('shows no tooltip for a category, even if it has a description', async () => {
    const { user, fetchScope } = renderItem('category');

    await user.hover(screen.getByTestId('scopes-tree-category'));

    expect(screen.getByText('Vault')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(fetchScope).not.toHaveBeenCalled();
  });

  it('shows no tooltip for a leaf that does not link to a scope', async () => {
    const { user, fetchScope } = renderItem('unlinked');

    await user.hover(screen.getByTestId('scopes-tree-unlinked'));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(fetchScope).not.toHaveBeenCalled();
  });

  it('shows no tooltip when the metadata cannot be loaded', async () => {
    const { user, fetchScope } = renderItem('full');
    fetchScope.mockRejectedValue(new Error('request failed'));

    await user.hover(screen.getByTestId('scopes-tree-full'));

    await waitFor(() => expect(fetchScope).toHaveBeenCalledWith('scope-full'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('hides the tooltip when the pointer leaves the scope', async () => {
    const { user } = renderItem('full');
    await user.hover(screen.getByTestId('scopes-tree-full'));
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await user.unhover(screen.getByTestId('scopes-tree-full'));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the tooltip while the scope has keyboard focus and hides it on blur', async () => {
    const { user } = renderItem('full');

    await user.tab();
    expect(await (await tooltip()).findByText('cluster = prod')).toBeInTheDocument();

    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('describes the highlighted tree item by the scope metadata so it is announced with it', async () => {
    renderItem('full', true);

    expect(await (await tooltip()).findByText('cluster = prod')).toBeInTheDocument();
    const treeItem = screen.getByRole('treeitem');
    const description = document.getElementById(treeItem.getAttribute('aria-describedby')!);

    expect(description).toHaveTextContent('Production Vault cluster');
    expect(description).toHaveTextContent('cluster = prod');
  });

  it('shows the tooltip again when the highlight returns to an item that was dismissed with Escape', async () => {
    const Harness = () => {
      const [highlighted, setHighlighted] = useState(true);
      return (
        <>
          <button onClick={() => setHighlighted((h) => !h)}>toggle highlight</button>
          {item('full', highlighted)}
        </>
      );
    };
    const { user } = renderWithScopesServices(<Harness />, { scopes, nodes });
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.click(screen.getByText('toggle highlight'));
    await user.click(screen.getByText('toggle highlight'));

    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  });

  it('shows one tooltip at a time when the keyboard highlight moves away from a hovered scope', async () => {
    const Harness = () => {
      const [highlighted, setHighlighted] = useState(false);
      useEffect(() => {
        const onKeyDown = () => setHighlighted(true);
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, []);
      return (
        <>
          {item('full')}
          {item('filtersOnly', highlighted)}
        </>
      );
    };
    const { user } = renderWithScopesServices(<Harness />, { scopes, nodes });
    await user.hover(screen.getByTestId('scopes-tree-full'));
    expect(await (await tooltip()).findByText('cluster = prod')).toBeInTheDocument();

    await user.keyboard('{ArrowDown}');

    expect(await (await tooltip()).findByText('region =~ us-.*')).toBeInTheDocument();
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(within(screen.getByRole('tooltip')).queryByText('cluster = prod')).not.toBeInTheDocument();
  });

  it('shows the keyboard highlighted tooltip again when the pointer leaves another scope', async () => {
    const { user } = renderWithScopesServices(
      <>
        {item('full', true)}
        {item('filtersOnly')}
      </>,
      { scopes, nodes }
    );
    expect(await (await tooltip()).findByText('cluster = prod')).toBeInTheDocument();

    await user.hover(screen.getByTestId('scopes-tree-filtersOnly'));
    expect(await (await tooltip()).findByText('region =~ us-.*')).toBeInTheDocument();

    await user.unhover(screen.getByTestId('scopes-tree-filtersOnly'));

    expect(await (await tooltip()).findByText('cluster = prod')).toBeInTheDocument();
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  });

  it('does not let Escape reach ancestors while it dismisses the tooltip', async () => {
    const onKeyDown = jest.fn();
    const { user } = renderWithScopesServices(<div onKeyDown={onKeyDown}>{item('full')}</div>, { scopes, nodes });
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
