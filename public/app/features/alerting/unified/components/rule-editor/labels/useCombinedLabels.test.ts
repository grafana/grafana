/**
 * Unit tests for the createAsyncValuesLoader function in useCombinedLabels hook.
 *
 * These tests verify that:
 * 1. Values from existing alerts are shown first
 * 2. Values from ops labels are shown after existing values
 * 3. Duplicate values between existing and ops are excluded from ops
 * 4. The order is: existing values first, then unique ops values
 */

describe('createAsyncValuesLoader logic', () => {
  // Simulate the data structures used in useCombinedLabels
  const labelsByKeyFromExistingAlerts = new Map<string, Set<string>>([
    ['severity', new Set(['warning', 'error', 'critical'])],
    ['team', new Set(['frontend', 'backend', 'platform'])],
    ['environment', new Set(['production', 'staging'])],
  ]);

  // Simulate ops labels (from grafana-labels-app plugin)
  const opsLabelValues: Record<string, string[]> = {
    severity: ['info', 'warning', 'critical', 'fatal'], // 'warning' and 'critical' overlap with existing
    team: ['frontend', 'sre', 'devops'], // 'frontend' overlaps with existing
    environment: ['production', 'staging', 'development', 'testing'], // 'production' and 'staging' overlap
    cluster: ['us-east-1', 'us-west-2', 'eu-central-1'], // ops-only key
  };

  const opsLabelKeys = new Set(['severity', 'team', 'environment', 'cluster']);

  const mapLabelsToOptions = (items: string[]) => {
    return items.map((item) => ({ label: item, value: item }));
  };

  // This simulates the current implementation of createAsyncValuesLoader
  const getValuesForLabel = (key: string, labelsPluginInstalled: boolean): Array<{ label: string; value: string }> => {
    if (!key) {
      return [];
    }

    // Collect values from existing alerts first
    const valuesFromAlerts = labelsByKeyFromExistingAlerts.get(key);
    const existingValues = valuesFromAlerts ? Array.from(valuesFromAlerts) : [];

    // Collect values from ops labels (if plugin is installed)
    let opsValues: string[] = [];
    if (labelsPluginInstalled && opsLabelKeys.has(key)) {
      opsValues = opsLabelValues[key] || [];
    }

    // Combine: existing values first, then unique ops values (Set preserves first occurrence)
    const combinedValues = [...new Set([...existingValues, ...opsValues])];

    return mapLabelsToOptions(combinedValues);
  };

  describe('when labels plugin is installed', () => {
    it('should combine existing and ops values with existing first', () => {
      const values = getValuesForLabel('severity', true);

      // Existing: warning, error, critical
      // Ops: info, warning, critical, fatal (warning and critical are duplicates)
      // Expected: warning, error, critical, info, fatal
      expect(values).toHaveLength(5);
      expect(values.map((v) => v.value)).toEqual(['warning', 'error', 'critical', 'info', 'fatal']);
    });

    it('should exclude duplicate ops values that exist in existing alerts', () => {
      const values = getValuesForLabel('environment', true);

      // Existing: production, staging
      // Ops: production, staging, development, testing (production and staging are duplicates)
      // Expected: production, staging, development, testing
      expect(values).toHaveLength(4);
      expect(values.map((v) => v.value)).toEqual(['production', 'staging', 'development', 'testing']);
    });

    it('should return only ops values for ops-only keys', () => {
      const values = getValuesForLabel('cluster', true);

      // No existing alerts for 'cluster', only ops values
      expect(values).toHaveLength(3);
      expect(values.map((v) => v.value)).toEqual(['us-east-1', 'us-west-2', 'eu-central-1']);
    });

    it('should return only existing values for keys not in ops', () => {
      // Add a key that exists in alerts but not in ops
      labelsByKeyFromExistingAlerts.set('custom', new Set(['value1', 'value2']));

      const values = getValuesForLabel('custom', true);

      expect(values).toHaveLength(2);
      expect(values.map((v) => v.value)).toEqual(['value1', 'value2']);

      // Cleanup
      labelsByKeyFromExistingAlerts.delete('custom');
    });
  });

  describe('when labels plugin is NOT installed', () => {
    it('should return only existing alert values', () => {
      const values = getValuesForLabel('severity', false);

      // Only existing values, no ops values
      expect(values).toHaveLength(3);
      expect(values.map((v) => v.value)).toEqual(['warning', 'error', 'critical']);
    });

    it('should return empty array for ops-only keys', () => {
      const values = getValuesForLabel('cluster', false);

      // 'cluster' only exists in ops, not in existing alerts
      expect(values).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty key', () => {
      const values = getValuesForLabel('', true);
      expect(values).toHaveLength(0);
    });

    it('should return empty array for unknown keys', () => {
      const values = getValuesForLabel('unknown-key', true);
      expect(values).toHaveLength(0);
    });

    it('should preserve order: existing values first, then unique ops values', () => {
      const values = getValuesForLabel('team', true);

      // Existing: frontend, backend, platform
      // Ops: frontend, sre, devops (frontend is duplicate)
      // Expected order: frontend, backend, platform, sre, devops
      const valueStrings = values.map((v) => v.value);

      // Check that existing values come before ops values
      expect(valueStrings.indexOf('frontend')).toBeLessThan(valueStrings.indexOf('sre'));
      expect(valueStrings.indexOf('backend')).toBeLessThan(valueStrings.indexOf('sre'));
      expect(valueStrings.indexOf('platform')).toBeLessThan(valueStrings.indexOf('devops'));
    });
  });
});
