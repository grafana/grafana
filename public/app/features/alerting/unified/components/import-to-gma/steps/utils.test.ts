import { skipToken } from '@reduxjs/toolkit/query/react';

import { mockImportFormValues } from '../testUtils';
import { type Step1Values } from '../types';

import {
  buildDryRunArgs,
  canRunDryRun,
  getRoutingTreeOptions,
  isStep1Valid,
  isStep2Valid,
  pickStep1Values,
  validatePolicyTreeName,
} from './utils';

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

describe('canRunDryRun', () => {
  const yamlFile = new File(['config'], 'am.yaml', { type: 'text/yaml' });

  it('returns true for a complete, valid YAML form', () => {
    expect(
      canRunDryRun({
        policyTreeName: 'prometheus-prod',
        notificationsSource: 'yaml',
        notificationsYamlFile: yamlFile,
        notificationsDatasourceUID: undefined,
        notificationsTemplateFiles: [],
        autoSyncNotificationsEnabled: false,
      })
    ).toBe(true);
  });

  it('returns false when Auto-sync is active, even with an otherwise-complete form', () => {
    expect(
      canRunDryRun({
        policyTreeName: 'prometheus-prod',
        notificationsSource: 'datasource',
        notificationsYamlFile: null,
        notificationsDatasourceUID: 'am-uid',
        notificationsTemplateFiles: [],
        autoSyncNotificationsEnabled: true,
      })
    ).toBe(false);
  });

  it('returns false when the policy tree name fails validation', () => {
    expect(
      canRunDryRun({
        policyTreeName: 'Invalid Name!',
        notificationsSource: 'yaml',
        notificationsYamlFile: yamlFile,
        notificationsDatasourceUID: undefined,
        notificationsTemplateFiles: [],
        autoSyncNotificationsEnabled: false,
      })
    ).toBe(false);
  });

  it('returns false when template files have a duplicate name', () => {
    expect(
      canRunDryRun({
        policyTreeName: 'prometheus-prod',
        notificationsSource: 'yaml',
        notificationsYamlFile: yamlFile,
        notificationsDatasourceUID: undefined,
        notificationsTemplateFiles: [
          new File(['a'], 'dupe.tmpl', { type: 'text/plain' }),
          new File(['b'], 'dupe.tmpl', { type: 'text/plain' }),
        ],
        autoSyncNotificationsEnabled: false,
      })
    ).toBe(false);
  });

  it('returns false when the YAML source is selected but no file is present', () => {
    expect(
      canRunDryRun({
        policyTreeName: 'prometheus-prod',
        notificationsSource: 'yaml',
        notificationsYamlFile: null,
        notificationsDatasourceUID: undefined,
        notificationsTemplateFiles: [],
        autoSyncNotificationsEnabled: false,
      })
    ).toBe(false);
  });
});

describe('buildDryRunArgs', () => {
  const yamlFile = new File(['route: {}'], 'am.yaml');
  const base: Step1Values = {
    policyTreeName: '',
    notificationsSource: 'yaml',
    notificationsDatasourceUID: undefined,
    notificationsDatasourceName: null,
    notificationsYamlFile: yamlFile,
    notificationsTemplateFiles: [],
    autoSyncNotificationsEnabled: false,
  };

  it('skips the dry run until a source is chosen', () => {
    expect(buildDryRunArgs({ ...base, notificationsYamlFile: null }, undefined)).toBe(skipToken);
  });

  it('skips the dry run while two template files share a name', () => {
    const templateFiles = [new File(['a'], 'same.tmpl'), new File(['b'], 'same.tmpl')];
    expect(buildDryRunArgs({ ...base, notificationsTemplateFiles: templateFiles }, undefined)).toBe(skipToken);
  });

  it('sends a valid policy tree name along as the config identifier', () => {
    const args = buildDryRunArgs({ ...base, policyTreeName: 'imported' }, undefined);

    expect(args).toMatchObject({ source: 'yaml', configIdentifier: 'imported' });
    // Compared by identity: toMatchObject would walk into the File.
    expect(args !== skipToken && args.yamlFile).toBe(yamlFile);
  });

  it('leaves out a policy tree name that would be rejected', () => {
    expect(buildDryRunArgs({ ...base, policyTreeName: 'Not Valid' }, undefined)).toMatchObject({
      configIdentifier: undefined,
    });
  });

  describe('with Auto-sync', () => {
    const autoSync: Step1Values = {
      ...base,
      notificationsSource: 'datasource',
      notificationsDatasourceUID: 'mimir-uid',
      notificationsDatasourceName: 'Mimir',
      notificationsYamlFile: null,
      autoSyncNotificationsEnabled: true,
      policyTreeName: 'typed-name',
    };

    it('waits until the name the sync will pick is known', () => {
      expect(buildDryRunArgs(autoSync, undefined)).toBe(skipToken);
    });

    it('checks under the name the sync will pick, not the typed one', () => {
      expect(buildDryRunArgs(autoSync, 'mimir-sync')).toMatchObject({
        source: 'datasource',
        datasourceName: 'Mimir',
        configIdentifier: 'mimir-sync',
      });
    });
  });
});

describe('pickStep1Values', () => {
  it('keeps exactly the step 1 fields', () => {
    const values = mockImportFormValues({
      step1Completed: true,
      policyTreeName: 'imported',
      notificationsSource: 'datasource',
      notificationsDatasourceUID: 'uid',
      notificationsDatasourceName: 'Mimir',
      autoSyncNotificationsEnabled: true,
      rulesSource: 'yaml',
      namespace: 'ns',
    });

    expect(pickStep1Values(values)).toEqual({
      policyTreeName: 'imported',
      notificationsSource: 'datasource',
      notificationsDatasourceUID: 'uid',
      notificationsDatasourceName: 'Mimir',
      notificationsYamlFile: null,
      notificationsTemplateFiles: [],
      autoSyncNotificationsEnabled: true,
    });
  });
});

describe('getRoutingTreeOptions', () => {
  const existing = [
    { label: 'default', value: 'default' },
    { label: 'other', value: 'other' },
  ];

  it('lists the trees the API knows when step 1 has not been completed', () => {
    expect(getRoutingTreeOptions(existing, 'imported', false)).toEqual(existing);
  });

  it('offers the tree step 1 will create first, since the API does not know it yet', () => {
    expect(getRoutingTreeOptions(existing, 'imported', true)).toEqual([
      { label: 'imported', value: 'imported' },
      ...existing,
    ]);
  });

  it('does not list a tree twice when the API already knows it', () => {
    expect(getRoutingTreeOptions(existing, 'other', true)).toEqual(existing);
  });

  it('adds nothing when step 1 will not create a tree', () => {
    expect(getRoutingTreeOptions(existing, '', true)).toEqual(existing);
  });
});

describe('isStep2Valid', () => {
  const dataSourceRules = {
    rulesSource: 'datasource' as const,
    rulesYamlFile: null,
    rulesDatasourceUID: 'prometheus-uid',
    selectedRoutingTree: 'imported',
    targetDatasourceUID: 'prometheus-uid',
    yamlImportTargetDatasourceUID: undefined,
  };
  const yamlRules = {
    ...dataSourceRules,
    rulesSource: 'yaml' as const,
    rulesYamlFile: new File(['groups: []'], 'rules.yaml'),
    rulesDatasourceUID: undefined,
    yamlImportTargetDatasourceUID: 'yaml-target-uid',
  };

  it('accepts a data source with a policy tree and a recording rules target', () => {
    expect(isStep2Valid(dataSourceRules)).toBe(true);
  });

  it.each([
    ['a data source', { rulesDatasourceUID: undefined }],
    ['a policy tree', { selectedRoutingTree: '' }],
    ['a recording rules target', { targetDatasourceUID: undefined }],
  ])('needs %s', (_, missing) => {
    expect(isStep2Valid({ ...dataSourceRules, ...missing })).toBe(false);
  });

  it('does not ask a data source rules source for a YAML target', () => {
    expect(isStep2Valid({ ...dataSourceRules, yamlImportTargetDatasourceUID: undefined })).toBe(true);
  });

  it('accepts a YAML file with a data source to run against', () => {
    expect(isStep2Valid(yamlRules)).toBe(true);
  });

  it('needs a data source to run the rules of a YAML file against', () => {
    expect(isStep2Valid({ ...yamlRules, yamlImportTargetDatasourceUID: undefined })).toBe(false);
  });

  it('needs the YAML file itself', () => {
    expect(isStep2Valid({ ...yamlRules, rulesYamlFile: null })).toBe(false);
  });
});
