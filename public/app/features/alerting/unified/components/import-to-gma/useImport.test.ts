import { buildRoutingParams } from './useImport';

describe('buildRoutingParams', () => {
  describe('when policy routing is enabled (feature flag ON)', () => {
    const usePolicyRouting = true;

    it('should return notificationSettings with policy when a routing tree is selected', () => {
      const result = buildRoutingParams('my-policy', usePolicyRouting);

      expect(result).toEqual({
        notificationSettings: JSON.stringify({ policy: 'my-policy' }),
      });
      expect(result).not.toHaveProperty('extraLabels');
    });

    it('should fall back to extraLabels=undefined when no routing tree is selected', () => {
      const result = buildRoutingParams(undefined, usePolicyRouting);

      expect(result).toEqual({ extraLabels: undefined });
      expect(result).not.toHaveProperty('notificationSettings');
    });

    it('should fall back to extraLabels=undefined for empty string routing tree', () => {
      const result = buildRoutingParams('', usePolicyRouting);

      expect(result).toEqual({ extraLabels: undefined });
      expect(result).not.toHaveProperty('notificationSettings');
    });
  });

  describe('when policy routing is disabled (feature flag OFF)', () => {
    const usePolicyRouting = false;

    it('should return extraLabels with the legacy label when a routing tree is selected', () => {
      const result = buildRoutingParams('my-policy', usePolicyRouting);

      expect(result).toEqual({
        extraLabels: '__grafana_managed_route__=my-policy',
      });
      expect(result).not.toHaveProperty('notificationSettings');
    });

    it('should return extraLabels=undefined when no routing tree is selected', () => {
      const result = buildRoutingParams(undefined, usePolicyRouting);

      expect(result).toEqual({ extraLabels: undefined });
      expect(result).not.toHaveProperty('notificationSettings');
    });

    it('should return extraLabels=undefined for empty string routing tree', () => {
      const result = buildRoutingParams('', usePolicyRouting);

      expect(result).toEqual({ extraLabels: undefined });
      expect(result).not.toHaveProperty('notificationSettings');
    });
  });
});
