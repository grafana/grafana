import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type Scope } from '@grafana/data';

import { RecentScopes } from './RecentScopes';
import { type RecentScopeSet } from './types';

const mockGetScope = jest.fn<Promise<Scope | undefined>, [string]>();

// The real services object is referentially stable, which the component's effect depends on
jest.mock('../ScopesContextProvider', () => {
  const services = {
    scopesSelectorService: {
      getScope: (id: string) => mockGetScope(id),
      getScopeNode: jest.fn().mockResolvedValue(undefined),
    },
  };
  return { useScopesServices: () => services };
});

const withFilters: RecentScopeSet = {
  scopeIds: ['with-filters'],
  scopes: [{ id: 'with-filters', title: 'Vault prod' }],
};
const bare: RecentScopeSet = { scopeIds: ['bare'], scopes: [{ id: 'bare', title: 'No metadata' }] };

describe('RecentScopes metadata tooltip', () => {
  beforeEach(() => {
    mockGetScope.mockReset();
    mockGetScope.mockImplementation(async (id) => ({
      metadata: { name: id },
      spec: {
        title: id,
        filters: id === 'with-filters' ? [{ key: 'cluster', operator: 'equals', value: 'prod' }] : [],
      },
    }));
  });

  const renderExpanded = async () => {
    const result = render(<RecentScopes recentScopes={[withFilters, bare]} onSelect={jest.fn()} />);
    await result.user.click(screen.getByTestId('scopes-selector-recent-scopes-section'));
    return result;
  };

  it('shows the filters when hovering a recent scope that has metadata', async () => {
    const { user } = await renderExpanded();

    await user.hover(screen.getByRole('button', { name: /Vault prod/ }));

    expect(await screen.findByText('cluster = prod')).toBeInTheDocument();
  });

  it('shows no tooltip for a recent scope without metadata', async () => {
    const { user } = await renderExpanded();
    // Let the scope fetches settle so the "no metadata" state is final
    await screen.findByRole('button', { name: /Vault prod/ });

    await user.hover(screen.getByRole('button', { name: /No metadata/ }));

    expect(screen.getByRole('button', { name: /No metadata/ })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
