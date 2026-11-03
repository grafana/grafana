import { useCallback } from 'react';

import { generatedAPI as rulesAPIv0alpha1 } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { generatedAPI as rulesAPIv1beta1 } from '@grafana/api-clients/rtkq/rules.alerting/v1beta1';

import { resolveRulesAPIVersion } from '../api/rulesApiVersion';
import {
  buildAlertRuleResource,
  buildRecordingRuleResource,
} from '../components/rule-editor/alert-rule-form/formValuesToAppPlatform';
import { type RuleFormValues } from '../types/rule-form';
import { isGrafanaRecordingRuleByType } from '../utils/rules';

type SaveArgs = {
  values: RuleFormValues;
  existingUid: string | undefined;
};

export function useUpsertUngroupedGrafanaRule() {
  // The served version is only known after discovery and hooks can't be called conditionally,
  // so both versions' mutations are set up. The rule types are identical across the versions.
  const [createAlertRule] = rulesAPIv1beta1.useCreateAlertRuleMutation();
  const [replaceAlertRule] = rulesAPIv1beta1.useReplaceAlertRuleMutation();
  const [createRecordingRule] = rulesAPIv1beta1.useCreateRecordingRuleMutation();
  const [replaceRecordingRule] = rulesAPIv1beta1.useReplaceRecordingRuleMutation();
  const [createAlertRuleV0alpha1] = rulesAPIv0alpha1.useCreateAlertRuleMutation();
  const [replaceAlertRuleV0alpha1] = rulesAPIv0alpha1.useReplaceAlertRuleMutation();
  const [createRecordingRuleV0alpha1] = rulesAPIv0alpha1.useCreateRecordingRuleMutation();
  const [replaceRecordingRuleV0alpha1] = rulesAPIv0alpha1.useReplaceRecordingRuleMutation();

  return useCallback(
    async ({ values, existingUid }: SaveArgs): Promise<string> => {
      const version = await resolveRulesAPIVersion();
      const isV1beta1 = version === 'v1beta1';
      const isRecordingRule = isGrafanaRecordingRuleByType(values.type);

      if (existingUid) {
        if (isRecordingRule) {
          const replace = isV1beta1 ? replaceRecordingRule : replaceRecordingRuleV0alpha1;
          await replace({
            name: existingUid,
            recordingRule: buildRecordingRuleResource(values, existingUid, version),
          }).unwrap();
        } else {
          const replace = isV1beta1 ? replaceAlertRule : replaceAlertRuleV0alpha1;
          await replace({
            name: existingUid,
            alertRule: buildAlertRuleResource(values, existingUid, version),
          }).unwrap();
        }
        return existingUid;
      }

      const created = isRecordingRule
        ? await (isV1beta1 ? createRecordingRule : createRecordingRuleV0alpha1)({
            recordingRule: buildRecordingRuleResource(values, undefined, version),
          }).unwrap()
        : await (isV1beta1 ? createAlertRule : createAlertRuleV0alpha1)({
            alertRule: buildAlertRuleResource(values, undefined, version),
          }).unwrap();

      // Codegen reuses K8s ObjectMeta for both request bodies and responses, so `name` is
      // typed as optional. The server always sets it on a successful create — this guard
      // is a TS narrowing safety net, not a real runtime case.
      if (!created.metadata.name) {
        throw new Error('Server response missing rule UID');
      }
      return created.metadata.name;
    },
    [
      createAlertRule,
      replaceAlertRule,
      createRecordingRule,
      replaceRecordingRule,
      createAlertRuleV0alpha1,
      replaceAlertRuleV0alpha1,
      createRecordingRuleV0alpha1,
      replaceRecordingRuleV0alpha1,
    ]
  );
}
