import { useState } from 'react';

import {
  type AlertRule,
  type RecordingRule,
  generatedAPI as rulesAPI,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { isFetchError, reportInteraction } from '@grafana/runtime';
import { useCreateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { type GrafanaPromRuleDTO, type GrafanaPromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { isProvisionedResource } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

export { useConvertGroup, planConversion };

const GROUP_LABEL = 'grafana.com/group';
const GROUP_INDEX_LABEL = 'grafana.com/group-index';

export type StayReason = 'provisioned' | 'plugin' | 'sequence' | 'sequence-unknown' | 'permission';

interface PlanInputs {
  /** The user may move rules out of the group's folder and into the target folder. */
  canMove: boolean;
  sequenceMembers: Set<string>;
  /** Rules whose sequence lookup failed; they can't be moved safely. */
  sequenceUnknown: Set<string>;
}

interface ConversionPlan {
  moves: GrafanaPromRuleDTO[];
  stays: Array<{ rule: GrafanaPromRuleDTO; reason: StayReason }>;
}

interface ConversionProgress {
  state: 'idle' | 'running' | 'done' | 'failed';
  movedUids: string[];
  /** Rules moved out of the group or deleted by someone else since the group was listed. */
  changedUids: string[];
  error?: unknown;
}

interface ConvertGroupOptions {
  group: GrafanaPromRuleGroupDTO;
  rules: GrafanaPromRuleDTO[];
  /** The subfolder, when it exists; otherwise the run creates it and reports it through onFolderCreated. */
  folderUid?: string;
  onFolderCreated: (uid: string) => void;
  /** Called when every rule was handled. */
  onDone: (progress: ConversionProgress, folderUid: string) => void;
}

function planConversion(group: GrafanaPromRuleGroupDTO, inputs: PlanInputs): ConversionPlan {
  const plan: ConversionPlan = { moves: [], stays: [] };
  for (const rule of group.rules) {
    const reason = stayReason(rule, inputs);
    if (reason) {
      plan.stays.push({ rule, reason });
    } else {
      plan.moves.push(rule);
    }
  }
  return plan;
}

/** Moves the rules one at a time. A retry skips the rules an earlier run already handled. */
function useConvertGroup({ group, rules, folderUid, onFolderCreated, onDone }: ConvertGroupOptions) {
  const [progress, setProgress] = useState<ConversionProgress>({ state: 'idle', movedUids: [], changedUids: [] });
  const [createFolder] = useCreateFolder();
  const [getAlertRule] = rulesAPI.useLazyGetAlertRuleQuery();
  const [getRecordingRule] = rulesAPI.useLazyGetRecordingRuleQuery();
  const [replaceAlertRule] = rulesAPI.useReplaceAlertRuleMutation();
  const [replaceRecordingRule] = rulesAPI.useReplaceRecordingRuleMutation();

  async function moveRule(
    rule: GrafanaPromRuleDTO,
    groupName: string,
    folderUid: string
  ): Promise<'moved' | 'changed'> {
    const name = rule.uid;
    const stillInGroup = (resource: AlertRule | RecordingRule) => resource.metadata.labels?.[GROUP_LABEL] === groupName;
    // A second attempt follows a 409: someone saved the rule between our read and write.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (rule.type === PromRuleType.Recording) {
          const resource = await getRecordingRule({ name }).unwrap();
          if (!stillInGroup(resource)) {
            return 'changed';
          }
          await replaceRecordingRule({ name, recordingRule: withoutGroup(resource, folderUid) }).unwrap();
        } else {
          const resource = await getAlertRule({ name }).unwrap();
          if (!stillInGroup(resource)) {
            return 'changed';
          }
          await replaceAlertRule({ name, alertRule: withoutGroup(resource, folderUid) }).unwrap();
        }
        return 'moved';
      } catch (error) {
        // Deleted since listed: someone else's change, like a move out of the group.
        if (isFetchError(error) && error.status === 404) {
          return 'changed';
        }
        if (!(isFetchError(error) && error.status === 409)) {
          throw error;
        }
      }
    }
    return 'changed';
  }

  async function convert() {
    // A retry carries on from the previous run's counts.
    let current: ConversionProgress = { ...progress, state: 'running', error: undefined };
    const handled = new Set([...progress.movedUids, ...progress.changedUids]);
    let createdUid: string | undefined;
    setProgress(current);
    try {
      let targetUid = folderUid;
      if (!targetUid) {
        const created = await createFolder({ title: group.name.trim(), parentUid: group.folderUid });
        if (created.error || !created.data) {
          throw created.error;
        }
        targetUid = createdUid = created.data.uid;
      }
      for (const rule of rules.filter(({ uid }) => !handled.has(uid))) {
        const result = await moveRule(rule, group.name, targetUid);
        current =
          result === 'moved'
            ? { ...current, movedUids: [...current.movedUids, rule.uid] }
            : { ...current, changedUids: [...current.changedUids, rule.uid] };
        setProgress(current);
      }
      current = { ...current, state: 'done' };
      setProgress(current);
      reportConversion(current, rules.length);
      onDone(current, targetUid);
    } catch (error) {
      current = { ...current, state: 'failed', error };
      setProgress(current);
      reportConversion(current, rules.length);
      // Only after a failure: telling the list mid-run would change the plan's target and restart its checks.
      if (createdUid) {
        onFolderCreated(createdUid);
      }
    }
  }

  return { progress, convert };
}

function reportConversion(progress: ConversionProgress, ruleCount: number) {
  const partial = progress.movedUids.length > 0 ? 'partial' : 'failed';
  reportInteraction('grafana_alerting_legacy_group_convert', {
    result: progress.state === 'failed' ? partial : 'success',
    ruleCount,
  });
}

function stayReason(rule: GrafanaPromRuleDTO, inputs: PlanInputs): StayReason | undefined {
  // Plugin first, matching the origin badge.
  if (getRulePluginOrigin({ labels: rule.labels })) {
    return 'plugin';
  }
  if (isProvisionedResource(rule.provenance)) {
    return 'provisioned';
  }
  if (inputs.sequenceMembers.has(rule.uid)) {
    return 'sequence';
  }
  if (inputs.sequenceUnknown.has(rule.uid)) {
    return 'sequence-unknown';
  }
  return inputs.canMove ? undefined : 'permission';
}

function withoutGroup<T extends AlertRule | RecordingRule>(resource: T, folderUid: string): T {
  const { [GROUP_LABEL]: _group, [GROUP_INDEX_LABEL]: _index, ...labels } = resource.metadata.labels ?? {};
  return {
    ...resource,
    metadata: {
      ...resource.metadata,
      labels,
      annotations: { ...resource.metadata.annotations, [AnnoKeyFolder]: folderUid },
    },
  };
}
