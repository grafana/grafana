import { EXTRA_CONFIG_UID, isExtraConfig } from './extraConfigs';

describe('extraConfigs utilities', () => {
  describe('isExtraConfig', () => {
    it('should return true for the exact extra config UID', () => {
      expect(isExtraConfig(EXTRA_CONFIG_UID)).toBe(true);
    });

    it('should return false for non-extra config names', () => {
      expect(isExtraConfig('grafana')).toBe(false);
      expect(isExtraConfig('prometheus-am')).toBe(false);
      expect(isExtraConfig('regular-alertmanager')).toBe(false);
      expect(isExtraConfig('')).toBe(false);
      expect(isExtraConfig('~grafana-converted-extra-config-test')).toBe(false); // old pattern
      expect(isExtraConfig('~grafana-with-extra-config-suffix')).toBe(false); // with suffix
    });
  });

  describe('EXTRA_CONFIG_UID constant', () => {
    it('should have the correct UID value', () => {
      expect(EXTRA_CONFIG_UID).toBe('~grafana-with-extra-config');
    });
  });
});
