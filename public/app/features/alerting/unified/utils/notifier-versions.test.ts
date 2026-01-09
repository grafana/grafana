import { NotificationChannelOption, NotifierDTO, NotifierVersion } from '../types/alerting';

import { canCreateNotifier, getOptionsForVersion, isLegacyVersion } from './notifier-versions';

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
        versions: [createVersion({ version: 'v0mimir1', canCreate: false })],
      });
      expect(isLegacyVersion(notifier, undefined)).toBe(false);
      expect(isLegacyVersion(notifier, '')).toBe(false);
    });

    it('should return false if notifier has no versions array', () => {
      const notifier = createNotifier({ versions: undefined });
      expect(isLegacyVersion(notifier, 'v0mimir1')).toBe(false);
    });

    it('should return false if notifier has empty versions array', () => {
      const notifier = createNotifier({ versions: [] });
      expect(isLegacyVersion(notifier, 'v0mimir1')).toBe(false);
    });

    it('should return false if version is not found in versions array', () => {
      const notifier = createNotifier({
        versions: [createVersion({ version: 'v1', canCreate: true })],
      });
      expect(isLegacyVersion(notifier, 'v0mimir1')).toBe(false);
    });

    it('should return false if version has canCreate: true', () => {
      const notifier = createNotifier({
        versions: [createVersion({ version: 'v1', canCreate: true })],
      });
      expect(isLegacyVersion(notifier, 'v1')).toBe(false);
    });

    it('should return false if version has canCreate: undefined', () => {
      const notifier = createNotifier({
        versions: [createVersion({ version: 'v1', canCreate: undefined })],
      });
      expect(isLegacyVersion(notifier, 'v1')).toBe(false);
    });

    it('should return true if version has canCreate: false', () => {
      const notifier = createNotifier({
        versions: [
          createVersion({ version: 'v0mimir1', canCreate: false }),
          createVersion({ version: 'v1', canCreate: true }),
        ],
      });
      expect(isLegacyVersion(notifier, 'v0mimir1')).toBe(true);
    });

    it('should correctly identify legacy versions in a mixed notifier', () => {
      const notifier = createNotifier({
        versions: [
          createVersion({ version: 'v0mimir1', canCreate: false }),
          createVersion({ version: 'v0mimir2', canCreate: false }),
          createVersion({ version: 'v1', canCreate: true }),
        ],
      });
      expect(isLegacyVersion(notifier, 'v0mimir1')).toBe(true);
      expect(isLegacyVersion(notifier, 'v0mimir2')).toBe(true);
      expect(isLegacyVersion(notifier, 'v1')).toBe(false);
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

    it('should return default options if no version is specified', () => {
      const notifier = createNotifier({
        options: defaultOptions,
        versions: [createVersion({ version: 'v1', options: v1Options })],
      });
      expect(getOptionsForVersion(notifier, undefined)).toBe(defaultOptions);
      expect(getOptionsForVersion(notifier, '')).toBe(defaultOptions);
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
});
