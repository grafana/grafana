import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { ScopesTooltip, type ScopesTooltipProps } from './ScopesInput';
import { type NodesMap, type ScopesMap, type SelectedScope } from './types';

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

    it('shows the node description and scope filters', () => {
      renderTooltip({ nodes: metadataNodes, scopes: metadataScopes });

      expect(screen.getByText('Production cluster')).toBeInTheDocument();
      expect(screen.getByText('cluster = prod')).toBeInTheDocument();
    });

    it('separates the metadata from the Remove all button with a divider', () => {
      renderTooltip({ nodes: metadataNodes, scopes: metadataScopes });

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
    });

    it('shows no divider when the Remove all button is hidden', () => {
      renderTooltip({ nodes: metadataNodes, scopes: metadataScopes, onRemoveAllClick: undefined });

      expect(screen.getByText('Production cluster')).toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    it('shows no divider when there is no metadata above the Remove all button', () => {
      renderTooltip();

      expect(screen.getByTestId('scopes-selector-input-clear')).toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });
  });
});
