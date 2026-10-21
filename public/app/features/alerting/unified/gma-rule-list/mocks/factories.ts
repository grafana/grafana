import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type RuleResourceState } from '../rule-data/ruleResourceState';
import { type RuleKind } from '../shared/analytics';

export function folderItem(uid: string, title: string) {
  return {
    resource: { group: 'folder.grafana.app', kind: 'Folder', name: uid, resource: 'folders' },
    fields: { title },
  };
}

/** One item of a rule search response. */
export function ruleItem(kind: RuleKind, uid: string, title: string, folder: string) {
  return {
    resource: {
      group: 'rules.alerting.grafana.app',
      kind: kind === 'alert' ? 'AlertRule' : 'RecordingRule',
      name: uid,
      resource: kind === 'alert' ? 'alertrules' : 'recordingrules',
    },
    fields: { title, folder },
  };
}

interface RuleOverrides {
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
  paused?: boolean;
  title?: string;
}

export function buildAlertRule({
  annotations = {},
  labels,
  paused = false,
  title = 'High CPU usage',
}: RuleOverrides = {}) {
  const rule: AlertRule = {
    apiVersion: 'v0alpha1',
    kind: 'AlertRule',
    metadata: { name: 'rule-uid-1', annotations },
    spec: {
      title,
      labels,
      paused,
      execErrState: 'Alerting',
      noDataState: 'NoData',
      trigger: { interval: '1m' },
      expressions: {},
    },
  };
  return rule;
}

export function buildRecordingRule({
  annotations = {},
  labels,
  paused = false,
  title = 'cpu_usage:avg',
}: RuleOverrides = {}) {
  const rule: RecordingRule = {
    apiVersion: 'v0alpha1',
    kind: 'RecordingRule',
    metadata: { name: 'rule-uid-1', annotations },
    spec: {
      title,
      labels,
      paused,
      metric: 'cpu_usage:avg',
      targetDatasourceUID: 'prom-1',
      trigger: { interval: '1m' },
      expressions: {},
    },
  };
  return rule;
}

export function loadedRule<T extends AlertRule | RecordingRule>(rule: T): RuleResourceState<T> {
  return { status: 'loaded', rule };
}

export const LOADING_RULE: RuleResourceState<never> = { status: 'loading' };
export const FAILED_RULE: RuleResourceState<never> = { status: 'error' };
