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
});
