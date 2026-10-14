import { t } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';

import { ruleEditUrl } from '../rule-actions/ruleLinks';
import { useRuleActionAbilities } from '../rule-actions/useRuleActionAbilities';
import { refreshRuleLists } from '../rule-data/refreshRuleLists';
import { invalidateFullRecordingRule, useFullRecordingRuleState } from '../rule-data/ruleResourceLookups';

import { RecordingRuleActionsMenu } from './RecordingRuleActionsMenu';

interface RecordingRuleActionsProps {
  ruleUid: string;
}

export function RecordingRuleActions({ ruleUid }: RecordingRuleActionsProps) {
  const resourceState = useFullRecordingRuleState(ruleUid);
  const abilities = useRuleActionAbilities(resourceState);

  const onMutated = () => {
    invalidateFullRecordingRule(ruleUid);
    refreshRuleLists('recording');
  };

  return (
    <Stack direction="row" gap={0} wrap="nowrap">
      {abilities.edit.available && (
        <LinkButton size="sm" variant="secondary" fill="text" href={ruleEditUrl(ruleUid)}>
          {t('alerting.gma-rule-list.recording-rules.edit', 'Edit')}
        </LinkButton>
      )}
      <RecordingRuleActionsMenu ruleUid={ruleUid} resourceState={resourceState} onMutated={onMutated} buttonSize="sm" />
    </Stack>
  );
}
