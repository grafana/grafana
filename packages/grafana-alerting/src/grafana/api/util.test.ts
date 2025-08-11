import { config } from '@grafana/runtime';

import { getAPIBaseURL, getAPINamespace, getAPIReducerPath } from './util';

describe('API utilities', () => {
  const originalAppSubUrl = config.appSubUrl;
  const originalNamespace = config.namespace;

  afterEach(() => {
    // Restore original config after each test
    config.appSubUrl = originalAppSubUrl;
    config.namespace = originalNamespace;
  });

  describe('getAPIBaseURL', () => {
    const group = 'notifications.alerting.grafana.app';
    const version = 'v0alpha1';

    it('should generate correct API base URL without subpath', () => {
      config.appSubUrl = '';
      config.namespace = 'default';

      const result = getAPIBaseURL(group, version);

      expect(result).toBe('/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default');
    });

    it('should generate correct API base URL with subpath', () => {
      config.appSubUrl = '/grafana';
      config.namespace = 'default';

      const result = getAPIBaseURL(group, version);

      expect(result).toBe('/grafana/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default');
    });

    it('should handle different namespace', () => {
      config.appSubUrl = '/grafana';
      config.namespace = 'custom-namespace';

      const result = getAPIBaseURL(group, version);

      expect(result).toBe('/grafana/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/custom-namespace');
    });
  });

  describe('getAPINamespace', () => {
    it('should return configured namespace', () => {
      config.namespace = 'test-namespace';

      const result = getAPINamespace();

      expect(result).toBe('test-namespace');
    });
  });

  describe('getAPIReducerPath', () => {
    it('should generate correct reducer path', () => {
      const group = 'notifications.alerting.grafana.app';
      const version = 'v0alpha1';

      const result = getAPIReducerPath(group, version);

      expect(result).toBe('notifications.alerting.grafana.app/v0alpha1');
    });
  });
});
