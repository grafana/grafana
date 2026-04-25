import { MemoryRouter, useLocation } from 'react-router-dom-v5-compat';
import { act, renderHook, screen } from 'test/test-utils';

import { useSyncedUrlDrawerParam } from './useSyncedUrlDrawerParam';

function LocationProbe() {
  const { search } = useLocation();
  return <div data-testid="search">{search}</div>;
}

describe('useSyncedUrlDrawerParam', () => {
  it('reads the param from the current search string', () => {
    const { result } = renderHook(() => useSyncedUrlDrawerParam('enrichment'), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[{ pathname: '/alerting/grafana/abc/view', search: '?enrichment=foo' }]}>
          {children}
        </MemoryRouter>
      ),
    });

    expect(result.current.value).toBe('foo');
  });

  it('returns null when the param is absent', () => {
    const { result } = renderHook(() => useSyncedUrlDrawerParam('enrichment'), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={[{ pathname: '/x' }]}>{children}</MemoryRouter>,
    });

    expect(result.current.value).toBeNull();
  });

  it('clears the param in the location when setValue is called with null (integration with locationService)', async () => {
    const { result } = renderHook(() => useSyncedUrlDrawerParam('enrichment'), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[{ pathname: '/x', search: '?enrichment=bar&tab=enrichment' }]}>
          <LocationProbe />
          {children}
        </MemoryRouter>
      ),
    });

    expect(result.current.value).toBe('bar');

    await act(async () => {
      result.current.setValue(null, true);
    });

    expect(screen.getByTestId('search')).not.toHaveTextContent(/enrichment=bar/);
  });
});
