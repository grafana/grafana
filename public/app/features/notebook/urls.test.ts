import { config } from '@grafana/runtime';

import { notebookShareUrl, notebookViewHref, notebookViewUrl } from './urls';

describe('notebook urls', () => {
  const originalAppSubUrl = config.appSubUrl;
  const originalAppUrl = config.appUrl;

  afterEach(() => {
    config.appSubUrl = originalAppSubUrl;
    config.appUrl = originalAppUrl;
  });

  describe('without a sub-path', () => {
    beforeEach(() => {
      config.appSubUrl = '';
      config.appUrl = 'https://host/';
    });

    it('builds the raw route', () => {
      expect(notebookViewUrl('nb1')).toBe('/notebook/nb1');
    });

    it('builds the same href for plain anchors', () => {
      expect(notebookViewHref('nb1')).toBe('/notebook/nb1');
    });

    it('builds an absolute share url', () => {
      expect(notebookShareUrl('nb1')).toBe('https://host/notebook/nb1');
    });
  });

  describe('under a sub-path', () => {
    beforeEach(() => {
      config.appSubUrl = '/grafana';
      config.appUrl = 'https://host/grafana/';
    });

    it('leaves the raw route unprefixed, since the router applies the base itself', () => {
      expect(notebookViewUrl('nb1')).toBe('/notebook/nb1');
    });

    it('prefixes the href for plain anchors, which never see the router base', () => {
      expect(notebookViewHref('nb1')).toBe('/grafana/notebook/nb1');
    });

    it('builds an absolute share url that keeps the sub-path exactly once', () => {
      expect(notebookShareUrl('nb1')).toBe('https://host/grafana/notebook/nb1');
    });
  });
});
