import { screen } from 'test/test-utils';

import { alertRuleFactory, folderFactory, recordingRuleFactory } from '../mocks/factories';
import { setupRuleListBackend } from '../mocks/ruleListBackend';

const FOLDERS = [
  folderFactory.build({ metadata: { name: 'team' }, spec: { title: 'Team Metrics' } }),
  folderFactory.build({ metadata: { name: 'platform' }, spec: { title: 'Platform' } }),
  folderFactory.inFolder('platform').build({ metadata: { name: 'infra' }, spec: { title: 'Infra' } }),
  folderFactory.build({ metadata: { name: 'alerts' }, spec: { title: 'Zeta Alerts' } }),
];

const RECORDING_RULES = [
  recordingRuleFactory.inFolder('team').build({ spec: { title: 'cpu:usage:rate5m' } }),
  recordingRuleFactory.inFolder('team').build({ spec: { title: 'disk:usage:rate5m' } }),
  recordingRuleFactory.inFolder('team').build({ spec: { title: 'mem:usage:rate5m' } }),
  recordingRuleFactory.inFolder('infra').build({ spec: { title: 'latency:p99' } }),
];

// Folder search lists folders holding rules of either kind, so Zeta Alerts is listed with no Recording rules.
const ALERT_RULES = [alertRuleFactory.inFolder('alerts').build({ spec: { title: 'CPU high' } })];

export function setup(options: Partial<Parameters<typeof setupRuleListBackend>[0]> = {}) {
  return setupRuleListBackend({
    folders: FOLDERS,
    alertRules: ALERT_RULES,
    recordingRules: RECORDING_RULES,
    ...options,
  });
}

export async function findFolderRow(title: string) {
  const row = (await screen.findByRole('link', { name: title })).closest('li');
  if (!row) {
    throw new Error(`No row for folder ${title}`);
  }
  return row;
}
