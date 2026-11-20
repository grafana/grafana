import { type ImportFormValues } from './types';

/** The wizard's initial form values, for tests that exercise a hook or helper outside the wizard. */
export function mockImportFormValues(overrides: Partial<ImportFormValues> = {}): ImportFormValues {
  return {
    step1Completed: false,
    step1Skipped: false,
    policyTreeName: '',
    notificationsSource: 'yaml',
    notificationsDatasourceUID: undefined,
    notificationsDatasourceName: null,
    notificationsYamlFile: null,
    notificationsTemplateFiles: [],
    autoSyncNotificationsEnabled: false,
    step2Completed: false,
    step2Skipped: false,
    selectedRoutingTree: '',
    rulesSource: 'datasource',
    rulesDatasourceUID: undefined,
    rulesDatasourceName: null,
    rulesYamlFile: null,
    pauseAlertingRules: true,
    pauseRecordingRules: true,
    ...overrides,
  };
}
