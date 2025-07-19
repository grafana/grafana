import { PluginExtensionPoints } from '@grafana/data';

import { getDataSourceExtensionConfigs } from './getDataSourceExtensionConfigs';

// Mock the utils function
jest.mock('../../plugins/extensions/utils', () => ({
  createAddedLinkConfig: jest.fn((config) => ({
    ...config,
    id: `mock-link-${config.title?.toLowerCase().replace(/\s+/g, '-')}`,
    type: 'link',
  })),
}));

describe('getDataSourceExtensionConfigs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return an array of extension configurations', () => {
    const configs = getDataSourceExtensionConfigs();

    expect(Array.isArray(configs)).toBe(true);
    expect(configs.length).toBeGreaterThan(0);
  });

  it('should include monitoring tool extension for DataSourceConfigActions', () => {
    const configs = getDataSourceExtensionConfigs();

    const monitoringConfig = configs.find(config =>
      config.title?.includes('Monitoring Tool')
    );

    expect(monitoringConfig).toBeDefined();
    expect(monitoringConfig?.targets).toContain(PluginExtensionPoints.DataSourceConfigActions);
    expect(monitoringConfig?.title).toBe('View in Monitoring Tool');
    expect(monitoringConfig?.description).toBe('Open this datasource in external monitoring dashboard');
    expect(monitoringConfig?.icon).toBe('external-link-alt');
    expect(monitoringConfig?.category).toBe('External Tools');
  });

  it('should include troubleshooting guide extension for DataSourceConfigStatus', () => {
    const configs = getDataSourceExtensionConfigs();

    const troubleshootingConfig = configs.find(config =>
      config.title?.includes('Troubleshooting Guide')
    );

    expect(troubleshootingConfig).toBeDefined();
    expect(troubleshootingConfig?.targets).toContain(PluginExtensionPoints.DataSourceConfigStatus);
    expect(troubleshootingConfig?.title).toBe('Troubleshooting Guide');
    expect(troubleshootingConfig?.description).toBe('Get help resolving this datasource issue');
    expect(troubleshootingConfig?.icon).toBe('question-circle');
    expect(troubleshootingConfig?.category).toBe('Help');
  });

  describe('Monitoring Tool Extension', () => {
    it('should have a configure function that filters by datasource type', () => {
      const configs = getDataSourceExtensionConfigs();
      const monitoringConfig = configs.find(config =>
        config.title?.includes('Monitoring Tool')
      );

      expect(monitoringConfig?.configure).toBeDefined();
      expect(typeof monitoringConfig?.configure).toBe('function');

      // Test with prometheus datasource (should be shown)
      const prometheusContext = {
        dataSource: {
          type: 'prometheus',
          uid: 'test-uid',
          name: 'Test Prometheus',
          typeName: 'Prometheus',
        },
      };

      const prometheusResult = monitoringConfig!.configure!(prometheusContext);
      expect(prometheusResult).toEqual({});

      // Test with non-prometheus datasource (should be hidden)
      const nonPrometheusContext = {
        dataSource: {
          type: 'mysql',
          uid: 'test-uid',
          name: 'Test MySQL',
          typeName: 'MySQL',
        },
      };

      const nonPrometheusResult = monitoringConfig!.configure!(nonPrometheusContext);
      expect(nonPrometheusResult).toBeUndefined();
    });

    it('should have an onClick function that opens external URL', () => {
      const configs = getDataSourceExtensionConfigs();
      const monitoringConfig = configs.find(config =>
        config.title?.includes('Monitoring Tool')
      );

      expect(monitoringConfig?.onClick).toBeDefined();
      expect(typeof monitoringConfig?.onClick).toBe('function');

      // Mock window.open
      const originalOpen = window.open;
      window.open = jest.fn();

      const context = {
        dataSource: {
          type: 'prometheus',
          uid: 'test-datasource-uid',
          name: 'Test Prometheus',
          typeName: 'Prometheus',
        },
      };

      monitoringConfig!.onClick!(
        undefined as any, // event
        { context } as any // meta
      );

      expect(window.open).toHaveBeenCalledWith(
        'https://monitoring-tool.com/datasource/test-datasource-uid',
        '_blank'
      );

      // Restore original window.open
      window.open = originalOpen;
    });
  });

  describe('Troubleshooting Guide Extension', () => {
    it('should have a configure function that filters by severity', () => {
      const configs = getDataSourceExtensionConfigs();
      const troubleshootingConfig = configs.find(config =>
        config.title?.includes('Troubleshooting Guide')
      );

      expect(troubleshootingConfig?.configure).toBeDefined();
      expect(typeof troubleshootingConfig?.configure).toBe('function');

      // Test with error severity (should be shown)
      const errorContext = {
        dataSource: {
          type: 'prometheus',
          uid: 'test-uid',
          name: 'Test Prometheus',
          typeName: 'Prometheus',
        },
        testingStatus: {
          status: 'error',
          message: 'Connection failed',
        },
        severity: 'error' as const,
      };

      const errorResult = troubleshootingConfig!.configure!(errorContext);
      expect(errorResult).toEqual({});

      // Test with success severity (should be hidden)
      const successContext = {
        ...errorContext,
        severity: 'success' as const,
      };

      const successResult = troubleshootingConfig!.configure!(successContext);
      expect(successResult).toBeUndefined();
    });

    it('should have a path to troubleshooting documentation', () => {
      const configs = getDataSourceExtensionConfigs();
      const troubleshootingConfig = configs.find(config =>
        config.title?.includes('Troubleshooting Guide')
      );

      expect(troubleshootingConfig?.path).toBe('/docs/troubleshooting/datasources');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully and return empty array', () => {
      // Mock createAddedLinkConfig to throw an error
      const createAddedLinkConfig = require('../../plugins/extensions/utils').createAddedLinkConfig;
      createAddedLinkConfig.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      // Mock console.warn to verify it's called
      const originalWarn = console.warn;
      console.warn = jest.fn();

      const configs = getDataSourceExtensionConfigs();

      expect(configs).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not configure datasource extensions')
      );

      // Restore original console.warn
      console.warn = originalWarn;
    });
  });

  describe('Extension Configuration Structure', () => {
    it('should use correct extension points', () => {
      const configs = getDataSourceExtensionConfigs();

      const actionExtensions = configs.filter(config =>
        config.targets?.includes(PluginExtensionPoints.DataSourceConfigActions)
      );
      const statusExtensions = configs.filter(config =>
        config.targets?.includes(PluginExtensionPoints.DataSourceConfigStatus)
      );

      expect(actionExtensions.length).toBeGreaterThan(0);
      expect(statusExtensions.length).toBeGreaterThan(0);
    });

    it('should have proper translation comments for all text', () => {
      const configs = getDataSourceExtensionConfigs();

      configs.forEach(config => {
        // All configurations should follow the pattern of not using translations
        // as documented in the specs (cannot use t() at top level)
        expect(config.title).toBeDefined();
        expect(config.description).toBeDefined();
        expect(config.category).toBeDefined();
      });
    });

    it('should have valid icons for all extensions', () => {
      const configs = getDataSourceExtensionConfigs();

      configs.forEach(config => {
        expect(config.icon).toBeDefined();
        expect(typeof config.icon).toBe('string');
      });
    });

    it('should have either path or onClick for all extensions', () => {
      const configs = getDataSourceExtensionConfigs();

      configs.forEach(config => {
        expect(
          config.path !== undefined || config.onClick !== undefined
        ).toBe(true);
      });
    });
  });

  describe('Context Type Safety', () => {
    it('should handle missing context gracefully in configure functions', () => {
      const configs = getDataSourceExtensionConfigs();

      configs.forEach(config => {
        if (config.configure) {
          // Test with undefined context
          const result = config.configure(undefined as any);
          expect(result).toBeUndefined();

          // Test with missing dataSource
          const resultNoDS = config.configure({ dataSource: undefined } as any);
          expect(resultNoDS).toBeUndefined();

          // Test with missing datasource type
          const resultNoType = config.configure({
            dataSource: { uid: 'test', name: 'test' }
          } as any);
          expect(resultNoType).toBeUndefined();
        }
      });
    });

    it('should validate context properties used in configure functions', () => {
      const configs = getDataSourceExtensionConfigs();

      const monitoringConfig = configs.find(config =>
        config.title?.includes('Monitoring Tool')
      );

      const troubleshootingConfig = configs.find(config =>
        config.title?.includes('Troubleshooting Guide')
      );

      // Monitoring config should check dataSource.type
      expect(monitoringConfig?.configure).toBeDefined();

      // Troubleshooting config should check severity
      expect(troubleshootingConfig?.configure).toBeDefined();
    });
  });
});
