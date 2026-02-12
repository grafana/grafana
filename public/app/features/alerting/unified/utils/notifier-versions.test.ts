import { GrafanaManagedContactPoint } from 'app/plugins/datasource/alertmanager/types';

import { NotificationChannelOption, NotifierDTO, NotifierVersion } from '../types/alerting';

import {
  canCreateNotifier,
  getLegacyVersionLabel,
  getOptionsForVersion,
  hasLegacyIntegrations,
  isDeprecated,
  isLegacyVersion,
} from './notifier-versions';

// Helper to create a minimal NotifierDTO for testing
function createNotifier(overrides: Partial<NotifierDTO> = {}): NotifierDTO {
  return {
    name: 'Test Notifier',
    description: 'Test description',
    type: 'webhook',
    heading: 'Test heading',
    options: [
      {
        element: 'input',
        inputType: 'text',
        label: 'Default Option',
        description: 'Default option description',
        placeholder: '',
        propertyName: 'defaultOption',
        required: true,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        dependsOn: '',
      },
    ],
    ...overrides,
  };
}

// Helper to create a NotifierVersion for testing
function createVersion(overrides: Partial<NotifierVersion> = {}): NotifierVersion {
  return {
    version: 'v1',
    label: 'Test Version',
    description: 'Test version description',
    options: [
      {
        element: 'input',
        inputType: 'text',
        label: 'Version Option',
        description: 'Version option description',
        placeholder: '',
        propertyName: 'versionOption',
        required: true,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        dependsOn: '',
      },
    ],
    ...overrides,
  };
}

describe('notifier-versions utilities', () => {
  describe('canCreateNotifier', () => {
    it('should return true if notifier has no versions array', () => {
      const notifier = createNotifier({ versions: undefined });
      expect(canCreateNotifier(notifier)).toBe(true);
    });

    it('should return true if notifier has empty versions array', () => {
      const notifier = createNotifier({ versions: [] });
      expect(canCreateNotifier(notifier)).toBe(true);
    });

    it('should return true if at least one version has canCreate: true', () => {
      const notifier = createNotifier({
        versions: [
          createVersion({ version: 'v0mimir1', canCreate: false }),
          createVersion({ version: 'v1', canCreate: true }),
        ],
      });
      expect(canCreateNotifier(notifier)).toBe(true);
    });

    it('should return true if at least one version has canCreate: undefined (defaults to true)', () => {
      const notifier = createNotifier({
        versions: [
          createVersion({ version: 'v0mimir1', canCreate: false }),
          createVersion({ version: 'v1', canCreate: undefined }),
        ],
      });
      expect(canCreateNotifier(notifier)).toBe(true);
    });

    it('should return false if all versions have canCreate: false', () => {
      const notifier = createNotifier({
        versions: [
          createVersion({ version: 'v0mimir1', canCreate: false }),
          createVersion({ version: 'v0mimir2', canCreate: false }),
        ],
      });
      expect(canCreateNotifier(notifier)).toBe(false);
    });

    it('should return false for notifiers like WeChat that only have legacy versions', () => {
      const wechatNotifier = createNotifier({
        name: 'WeChat',
        type: 'wechat',
        versions: [createVersion({ version: 'v0mimir1', canCreate: false })],
      });
      expect(canCreateNotifier(wechatNotifier)).toBe(false);
    });
  });

  describe('isLegacyVersion', () => {
    it('should return false if no version is specified', () => {
      const notifier = createNotifier({
        currentVersion: 'v1',
        versions: [createVersion({ version: 'v0mimir1' })],
      });
      expect(isLegacyVersion(notifier, undefined)).toBe(false);
      expect(isLegacyVersion(notifier, '')).toBe(false);
    });

    it('should return false if notifier has no currentVersion', () => {
      const notifier = createNotifier({ currentVersion: undefined });
      expect(isLegacyVersion(notifier, 'v0mimir1')).toBe(false);
    });

    it('should return false if version matches currentVersion', () => {
      const notifier = createNotifier({
        currentVersion: 'v1',
        versions: [createVersion({ version: 'v1' })],
      });
      expect(isLegacyVersion(notifier, 'v1')).toBe(false);
    });

    it('should return true if version is different from currentVersion', () => {
      const notifier = createNotifier({
        currentVersion: 'v1',
        versions: [createVersion({ version: 'v0mimir1' }), createVersion({ version: 'v1' })],
      });
      expect(isLegacyVersion(notifier, 'v0mimir1')).toBe(true);
    });

    it('should correctly identify legacy versions regardless of canCreate', () => {
      // Even if v1 has canCreate: false, it's NOT legacy if it's the currentVersion
      const notifier = createNotifier({
        currentVersion: 'v1',
        versions: [
          createVersion({ version: 'v0mimir1', canCreate: false }),
          createVersion({ version: 'v0mimir2', canCreate: false }),
          createVersion({ version: 'v1', canCreate: false }), // canCreate doesn't matter
        ],
      });
      expect(isLegacyVersion(notifier, 'v0mimir1')).toBe(true);
      expect(isLegacyVersion(notifier, 'v0mimir2')).toBe(true);
      expect(isLegacyVersion(notifier, 'v1')).toBe(false); // Not legacy because it's currentVersion
    });
  });

  describe('isDeprecated', () => {
    it('should return false if notifier has no deprecated field', () => {
      const notifier = createNotifier({});
      expect(isDeprecated(notifier)).toBe(false);
    });

    it('should return true if notifier has deprecated: true at top level', () => {
      const notifier = createNotifier({ deprecated: true });
      expect(isDeprecated(notifier)).toBe(true);
    });

    it('should return false if notifier has deprecated: false at top level', () => {
      const notifier = createNotifier({ deprecated: false });
      expect(isDeprecated(notifier)).toBe(false);
    });

    it('should return true if specific version has deprecated: true', () => {
      const notifier = createNotifier({
        versions: [
          createVersion({ version: 'v0', deprecated: true }),
          createVersion({ version: 'v1', deprecated: false }),
        ],
      });
      expect(isDeprecated(notifier, 'v0')).toBe(true);
      expect(isDeprecated(notifier, 'v1')).toBe(false);
    });

    it('should return true if notifier is deprecated regardless of version', () => {
      const notifier = createNotifier({
        deprecated: true,
        versions: [createVersion({ version: 'v1', deprecated: false })],
      });
      // Top-level deprecated takes precedence
      expect(isDeprecated(notifier, 'v1')).toBe(true);
    });

    it('should return false if version is not found in versions array', () => {
      const notifier = createNotifier({
        versions: [createVersion({ version: 'v1' })],
      });
      expect(isDeprecated(notifier, 'v2')).toBe(false);
    });

    it('should check currentVersion when no version is specified', () => {
      const notifier = createNotifier({
        currentVersion: 'v1',
        versions: [createVersion({ version: 'v1', deprecated: true })],
      });
      // No version specified, should check currentVersion (v1) which is deprecated
      expect(isDeprecated(notifier)).toBe(true);
    });

    it('should return false when currentVersion is not deprecated and no version specified', () => {
      const notifier = createNotifier({
        currentVersion: 'v1',
        versions: [
          createVersion({ version: 'v0', deprecated: true }),
          createVersion({ version: 'v1', deprecated: false }),
        ],
      });
      // No version specified, should check currentVersion (v1) which is not deprecated
      expect(isDeprecated(notifier)).toBe(false);
    });
  });

  describe('getOptionsForVersion', () => {
    const defaultOptions: NotificationChannelOption[] = [
      {
        element: 'input',
        inputType: 'text',
        label: 'Default URL',
        description: 'Default URL description',
        placeholder: '',
        propertyName: 'url',
        required: true,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        dependsOn: '',
      },
    ];

    const v0Options: NotificationChannelOption[] = [
      {
        element: 'input',
        inputType: 'text',
        label: 'Legacy URL',
        description: 'Legacy URL description',
        placeholder: '',
        propertyName: 'legacyUrl',
        required: true,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        dependsOn: '',
      },
    ];

    const v1Options: NotificationChannelOption[] = [
      {
        element: 'input',
        inputType: 'text',
        label: 'Modern URL',
        description: 'Modern URL description',
        placeholder: '',
        propertyName: 'modernUrl',
        required: true,
        secure: false,
        showWhen: { field: '', is: '' },
        validationRule: '',
        dependsOn: '',
      },
    ];

    it('should return options from default creatable version if no version is specified', () => {
      const notifier = createNotifier({
        options: defaultOptions,
        versions: [createVersion({ version: 'v1', options: v1Options, canCreate: true })],
      });
      // When no version specified, should use options from the default creatable version
      expect(getOptionsForVersion(notifier, undefined)).toBe(v1Options);
    });

    it('should return default options if no version is specified and empty string is passed', () => {
      const notifier = createNotifier({
        options: defaultOptions,
        versions: [createVersion({ version: 'v1', options: v1Options, canCreate: true })],
      });
      // Empty string is still a falsy version, so should use default creatable version
      expect(getOptionsForVersion(notifier, '')).toBe(v1Options);
    });

    it('should return default options if notifier has no versions array', () => {
      const notifier = createNotifier({
        options: defaultOptions,
        versions: undefined,
      });
      expect(getOptionsForVersion(notifier, 'v1')).toBe(defaultOptions);
    });

    it('should return default options if notifier has empty versions array', () => {
      const notifier = createNotifier({
        options: defaultOptions,
        versions: [],
      });
      expect(getOptionsForVersion(notifier, 'v1')).toBe(defaultOptions);
    });

    it('should return default options if version is not found', () => {
      const notifier = createNotifier({
        options: defaultOptions,
        versions: [createVersion({ version: 'v1', options: v1Options })],
      });
      expect(getOptionsForVersion(notifier, 'v0mimir1')).toBe(defaultOptions);
    });

    it('should return version-specific options when version is found', () => {
      const notifier = createNotifier({
        options: defaultOptions,
        versions: [
          createVersion({ version: 'v0mimir1', options: v0Options }),
          createVersion({ version: 'v1', options: v1Options }),
        ],
      });
      expect(getOptionsForVersion(notifier, 'v0mimir1')).toBe(v0Options);
      expect(getOptionsForVersion(notifier, 'v1')).toBe(v1Options);
    });

    it('should return default options if version found but has no options', () => {
      const notifier = createNotifier({
        options: defaultOptions,
        versions: [
          {
            version: 'v1',
            label: 'V1',
            description: 'V1 description',
            options: undefined as unknown as NotificationChannelOption[],
          },
        ],
      });
      expect(getOptionsForVersion(notifier, 'v1')).toBe(defaultOptions);
    });
  });

  describe('hasLegacyIntegrations', () => {
    // Helper to create a minimal contact point for testing
    function createContactPoint(overrides: Partial<GrafanaManagedContactPoint> = {}): GrafanaManagedContactPoint {
      return {
        name: 'Test Contact Point',
        ...overrides,
      };
    }

    // Create notifiers with version info for testing
    const notifiersWithVersions: NotifierDTO[] = [
      createNotifier({
        type: 'slack',
        currentVersion: 'v1',
        versions: [
          createVersion({ version: 'v0mimir1', canCreate: false }),
          createVersion({ version: 'v1', canCreate: true }),
        ],
      }),
      createNotifier({
        type: 'webhook',
        currentVersion: 'v1',
        versions: [
          createVersion({ version: 'v0mimir1', canCreate: false }),
          createVersion({ version: 'v0mimir2', canCreate: false }),
          createVersion({ version: 'v1', canCreate: true }),
        ],
      }),
    ];

    it('should return false if contact point is undefined', () => {
      expect(hasLegacyIntegrations(undefined, notifiersWithVersions)).toBe(false);
    });

    it('should return false if notifiers is undefined', () => {
      const contactPoint = createContactPoint({
        grafana_managed_receiver_configs: [{ type: 'slack', settings: {}, version: 'v0mimir1' }],
      });
      expect(hasLegacyIntegrations(contactPoint, undefined)).toBe(false);
    });

    it('should return false if contact point has no integrations', () => {
      const contactPoint = createContactPoint({ grafana_managed_receiver_configs: undefined });
      expect(hasLegacyIntegrations(contactPoint, notifiersWithVersions)).toBe(false);
    });

    it('should return false if contact point has empty integrations array', () => {
      const contactPoint = createContactPoint({ grafana_managed_receiver_configs: [] });
      expect(hasLegacyIntegrations(contactPoint, notifiersWithVersions)).toBe(false);
    });

    it('should return false if all integrations have current version', () => {
      const contactPoint = createContactPoint({
        grafana_managed_receiver_configs: [
          { type: 'slack', settings: {}, version: 'v1' },
          { type: 'webhook', settings: {}, version: 'v1' },
        ],
      });
      expect(hasLegacyIntegrations(contactPoint, notifiersWithVersions)).toBe(false);
    });

    it('should return false if all integrations have no version', () => {
      const contactPoint = createContactPoint({
        grafana_managed_receiver_configs: [
          { type: 'slack', settings: {} },
          { type: 'webhook', settings: {} },
        ],
      });
      expect(hasLegacyIntegrations(contactPoint, notifiersWithVersions)).toBe(false);
    });

    it('should return true if any integration has a legacy version (not current version)', () => {
      const contactPoint = createContactPoint({
        grafana_managed_receiver_configs: [
          { type: 'slack', settings: {}, version: 'v0mimir1' },
          { type: 'webhook', settings: {}, version: 'v1' },
        ],
      });
      expect(hasLegacyIntegrations(contactPoint, notifiersWithVersions)).toBe(true);
    });

    it('should return true if all integrations have legacy versions', () => {
      const contactPoint = createContactPoint({
        grafana_managed_receiver_configs: [
          { type: 'slack', settings: {}, version: 'v0mimir1' },
          { type: 'webhook', settings: {}, version: 'v0mimir2' },
        ],
      });
      expect(hasLegacyIntegrations(contactPoint, notifiersWithVersions)).toBe(true);
    });

    it('should return false if notifier type is not found in notifiers array', () => {
      const contactPoint = createContactPoint({
        grafana_managed_receiver_configs: [{ type: 'unknown', settings: {}, version: 'v0mimir1' }],
      });
      expect(hasLegacyIntegrations(contactPoint, notifiersWithVersions)).toBe(false);
    });
  });

  describe('getLegacyVersionLabel', () => {
    it('should return "Legacy" for undefined version', () => {
      expect(getLegacyVersionLabel(undefined)).toBe('Legacy');
    });

    it('should return "Legacy" for empty string version', () => {
      expect(getLegacyVersionLabel('')).toBe('Legacy');
    });

    it('should return "Legacy" for v0mimir1', () => {
      expect(getLegacyVersionLabel('v0mimir1')).toBe('Legacy');
    });

    it('should return "Legacy v2" for v0mimir2', () => {
      expect(getLegacyVersionLabel('v0mimir2')).toBe('Legacy v2');
    });

    it('should return "Legacy v3" for v0mimir3', () => {
      expect(getLegacyVersionLabel('v0mimir3')).toBe('Legacy v3');
    });

    it('should return "Legacy" for v1 (trailing 1)', () => {
      expect(getLegacyVersionLabel('v1')).toBe('Legacy');
    });

    it('should return "Legacy v2" for v2 (trailing 2)', () => {
      expect(getLegacyVersionLabel('v2')).toBe('Legacy v2');
    });

    it('should return "Legacy" for version strings without trailing number', () => {
      expect(getLegacyVersionLabel('legacy')).toBe('Legacy');
    });
  });
});
