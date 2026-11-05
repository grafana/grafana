import { Factory } from 'fishery';

import { type Folder } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type RuleKind } from '../shared/ruleKind';

/** The annotation app platform resources use to name their parent folder. */
export const FOLDER_ANNOTATION = 'grafana.app/folder';

class FolderFactory extends Factory<Folder> {
  inFolder(parentUid: string) {
    return this.params({ metadata: { annotations: { [FOLDER_ANNOTATION]: parentUid } } });
  }
}

/** A folder as the folder API stores it. */
export const folderFactory = FolderFactory.define(({ sequence }) => ({
  apiVersion: 'folder.grafana.app/v1beta1',
  kind: 'Folder',
  metadata: { name: `folder-${sequence}` },
  spec: { title: `Folder ${sequence}` },
}));

class AlertRuleFactory extends Factory<AlertRule> {
  inFolder(folderUid: string) {
    return this.params({ metadata: { annotations: { [FOLDER_ANNOTATION]: folderUid } } });
  }
}

/** An Alert rule as the rules API stores it. */
export const alertRuleFactory = AlertRuleFactory.define(({ sequence }) => ({
  apiVersion: 'rules.alerting.grafana.app/v0alpha1',
  kind: 'AlertRule',
  metadata: { name: `alert-rule-${sequence}` },
  spec: {
    title: `Alert rule ${sequence}`,
    trigger: { interval: '1m' },
    expressions: { A: { model: {}, source: true } },
    execErrState: 'Error' as const,
    noDataState: 'NoData' as const,
  },
}));

class RecordingRuleFactory extends Factory<RecordingRule> {
  inFolder(folderUid: string) {
    return this.params({ metadata: { annotations: { [FOLDER_ANNOTATION]: folderUid } } });
  }
}

/** A recording rule as the rules API stores it. */
export const recordingRuleFactory = RecordingRuleFactory.define(({ sequence }) => ({
  apiVersion: 'rules.alerting.grafana.app/v0alpha1',
  kind: 'RecordingRule',
  metadata: { name: `recording-rule-${sequence}` },
  spec: {
    title: `recording_rule_${sequence}`,
    metric: `recording_rule_${sequence}`,
    trigger: { interval: '1m' },
    expressions: { A: { model: {}, source: true } },
    targetDatasourceUID: 'prometheus',
  },
}));

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
