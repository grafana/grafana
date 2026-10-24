import { screen, waitFor } from '@testing-library/react';
import { render, testWithFeatureToggles } from 'test/test-utils';

import { type Scope, type ScopeNode } from '@grafana/data';

import { ScopesTooltip, type ScopesTooltipProps } from './ScopesInput';
import { renderWithScopesServices } from './tooltipTestUtils';
import { type NodesMap, type ScopesMap, type SelectedScope } from './types';

testWithFeatureToggles({ enable: ['scopeFilters'] });

const nodes: NodesMap = {
  'node-1': {
    metadata: { name: 'node-1' },
    spec: { nodeType: 'leaf', title: 'Test Node', parentName: '' },
  },
};

const scopesMap: ScopesMap = {
  'scope-1': {
    metadata: { name: 'scope-1' },
    spec: { title: 'Test Scope' },
  },
};

const appliedScopes: SelectedScope[] = [{ scopeId: 'scope-1', scopeNodeId: 'node-1' }];

const renderTooltip = (overrides: Partial<ScopesTooltipProps> = {}) =>
  render(
    <ScopesTooltip
      nodes={nodes}
      scopes={scopesMap}
      appliedScopes={appliedScopes}
      onRemoveAllClick={jest.fn()}
      disabled={false}
      {...overrides}
    />
  );

describe('ScopesTooltip', () => {
  it('renders the Remove all button when onRemoveAllClick is provided and not disabled', () => {
    renderTooltip();
    expect(screen.getByTestId('scopes-selector-input-clear')).toBeInTheDocument();
  });

  it('hides the Remove all button when onRemoveAllClick is undefined (e.g., scopes-first mode active)', () => {
    renderTooltip({ onRemoveAllClick: undefined });
    expect(screen.queryByTestId('scopes-selector-input-clear')).not.toBeInTheDocument();
  });

  it('hides the Remove all button when disabled, even if onRemoveAllClick is provided', () => {
    renderTooltip({ disabled: true });
    expect(screen.queryByTestId('scopes-selector-input-clear')).not.toBeInTheDocument();
  });

  describe('metadata', () => {
    const metadataNodes: NodesMap = {
      'node-1': {
        metadata: { name: 'node-1' },
        spec: { nodeType: 'leaf', title: 'Test Node', parentName: '', description: 'Production cluster' },
      },
    };
    const metadataScopes: ScopesMap = {
      'scope-1': {
        metadata: { name: 'scope-1' },
        spec: { title: 'Test Scope', filters: [{ key: 'cluster', operator: 'equals', value: 'prod' }] },
      },
    };

    it('shows the node description and scope filters, separated from the Remove all button by a divider', () => {
      renderTooltip({ nodes: metadataNodes, scopes: metadataScopes });

      expect(screen.getByText('Production cluster')).toBeInTheDocument();
      expect(screen.getByText('cluster = prod')).toBeInTheDocument();
      expect(screen.getByRole('separator')).toBeInTheDocument();
      expect(screen.getByTestId('scopes-selector-input-clear')).toBeInTheDocument();
    });

    it('puts a divider before the metadata of each scope when several scopes are applied', () => {
      renderTooltip({
        appliedScopes: [
          { scopeId: 'scope-1', scopeNodeId: 'node-1' },
          { scopeId: 'scope-2', scopeNodeId: 'node-2' },
        ],
        nodes: {
          ...metadataNodes,
          'node-2': {
            metadata: { name: 'node-2' },
            spec: { nodeType: 'leaf', title: 'Second Node', parentName: '', description: 'Staging cluster' },
          },
        },
        scopes: {
          ...metadataScopes,
          'scope-2': { metadata: { name: 'scope-2' }, spec: { title: 'Second Scope' } },
        },
      });

      // One before each metadata section, plus the one above Remove all
      expect(screen.getAllByRole('separator')).toHaveLength(3);
      // Each section is labelled with the name of its scope
      expect(screen.getByText('Test Node')).toBeInTheDocument();
      expect(screen.getByText('Second Node')).toBeInTheDocument();
    });

    it.each<{ desc: string; overrides: Partial<ScopesTooltipProps>; withMetadata: boolean }>([
      { desc: 'the Remove all button is hidden', overrides: { onRemoveAllClick: undefined }, withMetadata: true },
      { desc: 'there is no metadata above the Remove all button', overrides: {}, withMetadata: false },
    ])('shows no divider when $desc', ({ overrides, withMetadata }) => {
      renderTooltip(withMetadata ? { nodes: metadataNodes, scopes: metadataScopes, ...overrides } : overrides);

      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });
  });

  it('loads the description of applied scopes that were not picked from a cached node', async () => {
    const second: Scope = {
      metadata: { name: 'scope-2' },
      spec: { title: 'Second Scope', defaultPath: ['root', 'node-2'] },
    };
    const secondNode: ScopeNode = {
      metadata: { name: 'node-2' },
      spec: {
        nodeType: 'leaf',
        title: 'Second Node',
        parentName: 'root',
        linkType: 'scope',
        linkId: 'scope-2',
        description: 'Staging cluster',
      },
    };

    renderWithScopesServices(
      <ScopesTooltip
        nodes={nodes}
        scopes={scopesMap}
        appliedScopes={[{ scopeId: 'scope-1', scopeNodeId: 'node-1' }, { scopeId: 'scope-2' }]}
        onRemoveAllClick={jest.fn()}
        disabled={false}
      />,
      { scopes: [second], nodes: [secondNode] }
    );

    expect(await screen.findByText('Staging cluster')).toBeInTheDocument();
  });

  it('replaces a cached description once the loaded node turns out not to belong to the scope', async () => {
    const category: ScopeNode = {
      metadata: { name: 'node-1' },
      spec: { nodeType: 'container', title: 'Category', parentName: '', description: 'Category description' },
    };
    const scope1: Scope = {
      metadata: { name: 'scope-1' },
      spec: { title: 'Test Scope', filters: [{ key: 'env', operator: 'equals', value: 'qa' }] },
    };

    renderWithScopesServices(
      <ScopesTooltip
        nodes={{ 'node-1': category }}
        scopes={{ 'scope-1': scope1 }}
        appliedScopes={appliedScopes}
        onRemoveAllClick={jest.fn()}
        disabled={false}
      />,
      { scopes: [scope1], nodes: [category] }
    );

    expect(screen.getByText('Category description')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Category description')).not.toBeInTheDocument());
    expect(screen.getByText('env = qa')).toBeInTheDocument();
  });
});
