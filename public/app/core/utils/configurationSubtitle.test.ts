import { contextSrv } from 'app/core/services/context_srv';

import { getConfigurationSubtitle, shouldShowConfigurationSubtitle } from './configurationSubtitle';

describe('configurationSubtitle', () => {
  beforeEach(() => {
    contextSrv.user.orgCount = 2;
  });

  describe('getConfigurationSubtitle', () => {
    it('returns organization subtitle when user belongs to multiple orgs', () => {
      expect(getConfigurationSubtitle('Main Org.')).toBe('Organization: Main Org.');
    });

    it('returns empty string when user belongs to a single org', () => {
      contextSrv.user.orgCount = 1;

      expect(getConfigurationSubtitle('Main Org.')).toBe('');
    });
  });

  describe('shouldShowConfigurationSubtitle', () => {
    it('returns false for organization subtitle when user belongs to a single org', () => {
      contextSrv.user.orgCount = 1;

      expect(shouldShowConfigurationSubtitle('Organization: Main Org.')).toBe(false);
    });

    it('returns true for organization subtitle when user belongs to multiple orgs', () => {
      expect(shouldShowConfigurationSubtitle('Organization: Main Org.')).toBe(true);
    });

    it('returns true for non-organization subtitles regardless of org count', () => {
      contextSrv.user.orgCount = 1;

      expect(shouldShowConfigurationSubtitle('Manage default preferences and settings across Grafana')).toBe(true);
    });
  });
});
