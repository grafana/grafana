import { MAX_PAGE_URL_LENGTH, TRUNCATION_MARKER } from '@grafana/runtime';

import { Echo } from './Echo';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  MAX_PAGE_URL_LENGTH: 2048,
  TRUNCATION_MARKER: '[url too long]',
}));

jest.mock('../context_srv', () => ({
  contextSrv: {
    user: { id: 1, login: 'admin', isSignedIn: true, orgRole: 'Admin', orgId: 1 },
  },
}));

describe('Echo.getMeta URL truncation', () => {
  it('returns the full href when it is within the length limit', () => {
    const shortUrl = 'http://localhost:3000/d/abc?var-cluster=prod';
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: shortUrl, pathname: '/d/abc' },
      writable: true,
    });

    const echo = new Echo();
    const meta = echo.getMeta();

    expect(meta.url).toBe(shortUrl);
  });

  it('truncates href and appends the marker when it exceeds MAX_PAGE_URL_LENGTH', () => {
    const longHref = 'http://localhost:3000/d/abc?' + 'x'.repeat(MAX_PAGE_URL_LENGTH);
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: longHref, pathname: '/d/abc' },
      writable: true,
    });

    const echo = new Echo();
    const meta = echo.getMeta();
    const url = meta.url ?? '';

    expect(url.length).toBe(MAX_PAGE_URL_LENGTH);
    expect(url.endsWith(TRUNCATION_MARKER)).toBe(true);
  });
});
