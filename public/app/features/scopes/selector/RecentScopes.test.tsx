import { screen, waitFor, within } from '@testing-library/react';
import { testWithFeatureToggles } from 'test/test-utils';

import { type Scope, type ScopeNode } from '@grafana/data';

import { RecentScopes } from './RecentScopes';
import { renderWithScopesServices } from './tooltipTestUtils';
import { type RecentScopeSet } from './types';

const scope = (name: string, spec: Partial<Scope['spec']> = {}): Scope => ({
  metadata: { name },
  spec: { title: name, filters: [], ...spec },
});

const leafNode = (name: string, linkId: string, description?: string): ScopeNode => ({
  metadata: { name },
  spec: { nodeType: 'leaf', title: name, description, linkType: 'scope', linkId, parentName: 'category' },
});

const scopes = [
  scope('with-filters', { filters: [{ key: 'cluster', operator: 'equals', value: 'prod' }] }),
  scope('with-path', { defaultPath: ['', 'category', 'path-node'] }),
  scope('bare'),
  scope('orphan', { filters: [{ key: 'env', operator: 'equals', value: 'qa' }], defaultPath: ['', 'category'] }),
  scope('other', { filters: [{ key: 'env', operator: 'not-equals', value: 'dev' }] }),
];
const nodes = [
  {
    metadata: { name: 'category' },
    spec: { nodeType: 'container' as const, title: 'Category', description: 'Category description', parentName: '' },
  },
  leafNode('path-node', 'with-path', 'Found through the default path'),
  leafNode('stored-node', 'with-filters', 'Found through the stored node'),
];

const set = (id: string, scopeNodeId?: string): RecentScopeSet => ({
  scopeIds: [id],
  scopes: [{ id, title: `Title ${id}` }],
  scopeNodeId,
});

testWithFeatureToggles({ enable: ['scopeFilters'] });

const renderExpanded = async (recentScopes: RecentScopeSet[]) => {
  const result = renderWithScopesServices(<RecentScopes recentScopes={recentScopes} onSelect={jest.fn()} />, {
    scopes,
    nodes,
  });
  await result.user.click(screen.getByTestId('scopes-selector-recent-scopes-section'));
  return result;
};

describe('RecentScopes metadata tooltip', () => {
  it('shows the filters when hovering a recent scope', async () => {
    const { user } = await renderExpanded([set('with-filters')]);

    await user.hover(screen.getByRole('button', { name: /Title with-filters/ }));

    expect(await within(await screen.findByRole('tooltip')).findByText('cluster = prod')).toBeInTheDocument();
    expect(within(screen.getByRole('tooltip')).queryByRole('separator')).not.toBeInTheDocument();
  });

  it('shows the description of the node stored with the recent scope', async () => {
    const { user } = await renderExpanded([set('with-filters', 'stored-node')]);

    await user.hover(screen.getByRole('button', { name: /Title with-filters/ }));

    expect(
      await within(await screen.findByRole('tooltip')).findByText('Found through the stored node')
    ).toBeInTheDocument();
  });

  it('finds the description through the scope default path when no node is stored', async () => {
    const { user } = await renderExpanded([set('with-path')]);

    await user.hover(screen.getByRole('button', { name: /Title with-path/ }));

    expect(
      await within(await screen.findByRole('tooltip')).findByText('Found through the default path')
    ).toBeInTheDocument();
  });

  it('labels each scope with its title when the recent set has several scopes', async () => {
    const { user } = await renderExpanded([
      {
        scopeIds: ['with-filters', 'other'],
        scopes: [
          { id: 'with-filters', title: 'First' },
          { id: 'other', title: 'Second' },
        ],
      },
    ]);

    await user.hover(screen.getByRole('button', { name: /First, Second/ }));

    expect(await within(await screen.findByRole('tooltip')).findByText('cluster = prod')).toBeInTheDocument();
    expect(within(screen.getByRole('tooltip')).getByText('env != dev')).toBeInTheDocument();
    expect(within(screen.getByRole('tooltip')).getByText('First')).toBeInTheDocument();
    expect(within(screen.getByRole('tooltip')).getByText('Second')).toBeInTheDocument();
    // Only between the sections, not before the first one
    expect(within(screen.getByRole('tooltip')).getAllByRole('separator')).toHaveLength(1);
  });

  it('does not show the description of a category the default path ends on', async () => {
    const { user } = await renderExpanded([set('orphan')]);

    await user.hover(screen.getByRole('button', { name: /Title orphan/ }));

    expect(await within(await screen.findByRole('tooltip')).findByText('env = qa')).toBeInTheDocument();
    expect(screen.queryByText('Category description')).not.toBeInTheDocument();
  });

  it('does not apply the stored node to every scope of a recent set with several scopes', async () => {
    const { user } = await renderExpanded([
      {
        scopeIds: ['with-filters', 'other'],
        scopes: [
          { id: 'with-filters', title: 'First' },
          { id: 'other', title: 'Second' },
        ],
        scopeNodeId: 'stored-node',
      },
    ]);

    await user.hover(screen.getByRole('button', { name: /First, Second/ }));

    expect(await within(await screen.findByRole('tooltip')).findByText('env != dev')).toBeInTheDocument();
    expect(screen.queryByText('Found through the stored node')).not.toBeInTheDocument();
  });

  it('describes the recent scope button by its metadata', async () => {
    const { user } = await renderExpanded([set('with-filters')]);
    const button = screen.getByRole('button', { name: /Title with-filters/ });

    await user.hover(button);
    await screen.findByRole('tooltip');

    expect(document.getElementById(button.getAttribute('aria-describedby')!)).toHaveTextContent('cluster = prod');
  });

  it('shows no tooltip for a recent scope without a description or filters', async () => {
    const { user, fetchScope } = await renderExpanded([set('bare')]);

    await user.hover(screen.getByRole('button', { name: /Title bare/ }));

    await waitFor(() => expect(fetchScope).toHaveBeenCalledWith('bare'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
