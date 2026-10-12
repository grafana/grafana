import { t } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';

import { RecordingRuleActionsMenu } from '../actions/RecordingRuleActionsMenu';
import { ruleEditUrl } from '../actions/ruleLinks';
import { useRuleActionAbilities } from '../actions/useRuleActionAbilities';
import { invalidateFullRecordingRule, useFullRecordingRuleState } from '../shared/caches';
import { refreshRuleLists } from '../shared/refreshRuleLists';

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
