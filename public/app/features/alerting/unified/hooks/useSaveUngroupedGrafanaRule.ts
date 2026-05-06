import { useCallback } from 'react';

import {
  useCreateAlertRuleMutation,
  useCreateRecordingRuleMutation,
  useReplaceAlertRuleMutation,
  useReplaceRecordingRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import {
  buildAlertRuleResource,
  buildRecordingRuleResource,
  withMetadataName,
} from '../components/rule-editor/alert-rule-form/formValuesToAppPlatform';
import { type RuleFormValues } from '../types/rule-form';

type SaveArgs = {
  values: RuleFormValues;
  isRecordingRule: boolean;
  existingUid: string | undefined;
};

export function useSaveUngroupedGrafanaRule() {
  const [createAlertRule] = useCreateAlertRuleMutation();
  const [replaceAlertRule] = useReplaceAlertRuleMutation();
  const [createRecordingRule] = useCreateRecordingRuleMutation();
  const [replaceRecordingRule] = useReplaceRecordingRuleMutation();

  return useCallback(
    async ({ values, isRecordingRule, existingUid }: SaveArgs): Promise<string> => {
      if (existingUid) {
        if (isRecordingRule) {
          await replaceRecordingRule({
            name: existingUid,
            recordingRule: withMetadataName(buildRecordingRuleResource(values), existingUid),
          }).unwrap();
        } else {
          await replaceAlertRule({
            name: existingUid,
            alertRule: withMetadataName(buildAlertRuleResource(values), existingUid),
          }).unwrap();
        }
        return existingUid;
      }

      const created = isRecordingRule
        ? await createRecordingRule({ recordingRule: buildRecordingRuleResource(values) }).unwrap()
        : await createAlertRule({ alertRule: buildAlertRuleResource(values) }).unwrap();

      // Codegen reuses K8s ObjectMeta for both request bodies and responses, so `name` is
      // typed as optional. The server always sets it on a successful create — this guard
      // is a TS narrowing safety net, not a real runtime case.
      if (!created.metadata.name) {
        throw new Error('Server response missing rule UID');
      }
      return created.metadata.name;
    },
    [createAlertRule, replaceAlertRule, createRecordingRule, replaceRecordingRule]
  );
}
