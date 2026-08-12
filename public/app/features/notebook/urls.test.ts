import { createBrowserHistory, createMemoryHistory } from 'history';

import { HistoryWrapper, config, locationService, setLocationService } from '@grafana/runtime';

import { notebookShareUrl, notebookViewHref, notebookViewUrl } from './urls';

describe('notebook urls', () => {
  const originalLocationService = locationService;
  const originalAppUrl = config.appUrl;

  afterEach(() => {
    setLocationService(originalLocationService);
    config.appUrl = originalAppUrl;
  });

  /** Notebooks are org-scoped, so every browser-facing URL has to carry orgId. */
  function setHistory(orgId: number, basename?: string) {
    let base;
    if (basename) {
      // createBrowserHistory warns unless the document already sits under the basename.
      window.history.replaceState({}, '', `${basename}/`);
      base = createBrowserHistory({ basename });
    } else {
      base = createMemoryHistory({ initialEntries: ['/'] });
    }
    const wrapper = new HistoryWrapper(base);
    wrapper.setOrgIdGetter(() => orgId);
    setLocationService(wrapper);
  }

  it('keeps the raw route unprefixed, since the router applies the base itself', () => {
    setHistory(1);

    expect(notebookViewUrl('nb1')).toBe('/notebooks/nb1');
  });

  it('carries orgId on the href, so a link opens the org the notebook belongs to', () => {
    setHistory(3);

    expect(notebookViewHref('nb1')).toBe('/notebooks/nb1?orgId=3');
  });

  it('applies the sub-path when Grafana is served under one', () => {
    setHistory(1, '/grafana');

    expect(notebookViewHref('nb1')).toBe('/grafana/notebooks/nb1?orgId=1');
  });

  it('builds an absolute share url', () => {
    setHistory(3);
    config.appUrl = 'https://host/';

    expect(notebookShareUrl('nb1')).toBe('https://host/notebooks/nb1?orgId=3');
  });

  it('builds an absolute share url under a sub-path, keeping it exactly once', () => {
    setHistory(3, '/grafana');
    config.appUrl = 'https://host/grafana/';

    expect(notebookShareUrl('nb1')).toBe('https://host/grafana/notebooks/nb1?orgId=3');
  });
});
