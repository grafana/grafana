import { MemoryRouter } from 'react-router-dom-v5-compat';
import { renderHook } from 'test/test-utils';

import { useReturnTo } from './useReturnTo';

describe('useReturnTo', () => {
  beforeAll(() => {
    const win: typeof globalThis = window;
    // @ts-expect-error
    delete win.location;
    win.location = { origin: 'https://play.grafana.net' } as Location;
  });

  it('should return the fallback value when `returnTo` is not present in the query string', () => {
    //Adding this due to React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useReturnTo('/fallback'), { wrapper: MemoryRouter });

    expect(result.current.returnTo).toBe('/fallback');
    jest.spyOn(console, 'warn').mockRestore();
  });

  it('should return the sanitized `returnTo` value when it is present in the query string and is a valid URL within the Grafana app', () => {
    const { result } = renderHook(() => useReturnTo('/fallback'), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[{ search: '?returnTo=/dashboard/db/my-dashboard' }]}>{children}</MemoryRouter>
      ),
    });

    expect(result.current.returnTo).toBe('/dashboard/db/my-dashboard');
  });

  it('should return the fallback value when `returnTo` is present in the query string but is not a valid URL within the Grafana app', () => {
    const { result } = renderHook(() => useReturnTo('/fallback'), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[{ search: '?returnTo=https://example.com' }]}>{children}</MemoryRouter>
      ),
    });

    expect(result.current.returnTo).toBe('/fallback');
  });

  it('should return the fallback value when `returnTo` is present in the query string but is a malicious JavaScript URL', () => {
    const { result } = renderHook(() => useReturnTo('/fallback'), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[{ search: '?returnTo=javascript:alert(1)' }]}>{children}</MemoryRouter>
      ),
    });

    expect(result.current.returnTo).toBe('/fallback');
  });
});
