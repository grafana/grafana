import { isStep1Valid, validatePolicyTreeName } from './utils';

describe('validatePolicyTreeName', () => {
  it.each(['prometheus-prod', 'my-alertmanager', 'a', 'abc123', 'my.config.name', 'a-b.c-d', '0', '1abc2'])(
    'accepts valid name: "%s"',
    (name) => {
      expect(validatePolicyTreeName(name)).toBe(true);
    }
  );

  it.each([
    { name: '', reason: 'empty string' },
    { name: 'Uppercase', reason: 'contains uppercase letters' },
    { name: '-starts-with-dash', reason: 'starts with dash' },
    { name: 'ends-with-dash-', reason: 'ends with dash' },
    { name: '.starts-with-dot', reason: 'starts with dot' },
    { name: 'ends-with-dot.', reason: 'ends with dot' },
    { name: 'has spaces', reason: 'contains spaces' },
    { name: 'has_underscore', reason: 'contains underscore' },
    { name: 'special!char', reason: 'contains special characters' },
  ])('rejects invalid format ($reason): "$name"', ({ name }) => {
    const result = validatePolicyTreeName(name);
    expect(result).not.toBe(true);
    expect(result).toContain('lowercase alphanumeric');
  });

  it('rejects names exceeding 40 characters', () => {
    const longName = 'a'.repeat(41);
    const result = validatePolicyTreeName(longName);
    expect(result).not.toBe(true);
    expect(result).toContain('at most 40');
  });

  it('accepts names exactly 40 characters long', () => {
    const maxName = 'a'.repeat(40);
    expect(validatePolicyTreeName(maxName)).toBe(true);
  });

  it('checks length before format', () => {
    const longInvalid = 'A'.repeat(41);
    const result = validatePolicyTreeName(longInvalid);
    expect(result).toContain('at most 40');
  });
});

describe('isStep1Valid', () => {
  const yamlFile = new File(['config'], 'am.yaml', { type: 'text/yaml' });

  it('returns true for a complete, valid YAML form', () => {
    expect(
      isStep1Valid({
        policyTreeName: 'prometheus-prod',
        notificationsSource: 'yaml',
        notificationsYamlFile: yamlFile,
        notificationsDatasourceUID: undefined,
        notificationsTemplateFiles: [],
        autoSyncNotificationsEnabled: false,
      })
    ).toBe(true);
  });

  it('returns true for a complete, valid datasource form', () => {
    expect(
      isStep1Valid({
        policyTreeName: 'prometheus-prod',
        notificationsSource: 'datasource',
        notificationsYamlFile: null,
        notificationsDatasourceUID: 'am-uid',
        notificationsTemplateFiles: [],
        autoSyncNotificationsEnabled: false,
      })
    ).toBe(true);
  });

  it('returns false when the policy tree name is set but fails validation', () => {
    expect(
      isStep1Valid({
        policyTreeName: 'Invalid Name!',
        notificationsSource: 'yaml',
        notificationsYamlFile: yamlFile,
        notificationsDatasourceUID: undefined,
        notificationsTemplateFiles: [],
        autoSyncNotificationsEnabled: false,
      })
    ).toBe(false);
  });

  it('returns false when the policy tree name is empty', () => {
    expect(
      isStep1Valid({
        policyTreeName: '',
        notificationsSource: 'yaml',
        notificationsYamlFile: yamlFile,
        notificationsDatasourceUID: undefined,
        notificationsTemplateFiles: [],
        autoSyncNotificationsEnabled: false,
      })
    ).toBe(false);
  });

  it('returns false when template file names collide', () => {
    expect(
      isStep1Valid({
        policyTreeName: 'prometheus-prod',
        notificationsSource: 'yaml',
        notificationsYamlFile: yamlFile,
        notificationsDatasourceUID: undefined,
        notificationsTemplateFiles: [
          new File(['a'], 'dup.tmpl', { type: 'text/plain' }),
          new File(['b'], 'dup.tmpl', { type: 'text/plain' }),
        ],
        autoSyncNotificationsEnabled: false,
      })
    ).toBe(false);
  });

  it('returns false for the YAML source without a file', () => {
    expect(
      isStep1Valid({
        policyTreeName: 'prometheus-prod',
        notificationsSource: 'yaml',
        notificationsYamlFile: null,
        notificationsDatasourceUID: undefined,
        notificationsTemplateFiles: [],
        autoSyncNotificationsEnabled: false,
      })
    ).toBe(false);
  });

  describe('with Auto-sync enabled', () => {
    it('returns true once a data source is selected, even without a policy tree name', () => {
      expect(
        isStep1Valid({
          policyTreeName: '',
          notificationsSource: 'datasource',
          notificationsYamlFile: null,
          notificationsDatasourceUID: 'mimir-uid',
          notificationsTemplateFiles: [],
          autoSyncNotificationsEnabled: true,
        })
      ).toBe(true);
    });

    it('returns false without a data source selected', () => {
      expect(
        isStep1Valid({
          policyTreeName: '',
          notificationsSource: 'datasource',
          notificationsYamlFile: null,
          notificationsDatasourceUID: undefined,
          notificationsTemplateFiles: [],
          autoSyncNotificationsEnabled: true,
        })
      ).toBe(false);
    });

    it('is ignored for the YAML source — behaves as if unchecked', () => {
      expect(
        isStep1Valid({
          policyTreeName: '',
          notificationsSource: 'yaml',
          notificationsYamlFile: yamlFile,
          notificationsDatasourceUID: undefined,
          notificationsTemplateFiles: [],
          autoSyncNotificationsEnabled: true,
        })
      ).toBe(false);
    });
  });
});
