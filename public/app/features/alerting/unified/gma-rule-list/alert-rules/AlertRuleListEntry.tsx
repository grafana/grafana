import { useGetAlertRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { RuleActionsSkeleton } from '../../rule-list/components/RuleActionsSkeleton';
import { useFolderPath } from '../folder-browsing/folderLookups';
import { useOpenRuleSequence } from '../rule-sequences/RuleSequenceDrawer';
import { useRuleSequenceMembership } from '../rule-sequences/ruleSequenceMembership';

import { AlertRuleActions } from './AlertRuleActions';
import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleListEntryProps {
  searchHit: AlertRuleSearchHit;
  /** List mode only; Folders mode shows the folder on the folder row. */
  showFolderPath: boolean;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function AlertRuleListEntry({ searchHit, showFolderPath }: AlertRuleListEntryProps) {
  const folderPath = useFolderPath(showFolderPath ? searchHit.folderUid : undefined);
  const { data: fullRule, isLoading: isRuleLoading } = useGetAlertRuleQuery({ name: searchHit.uid });
  const { sequence, isLoading: isSequenceLoading } = useRuleSequenceMembership('alert', searchHit.uid);
  const isLoading = isRuleLoading || isSequenceLoading;
  const openRuleSequence = useOpenRuleSequence();

  let actions = null;
  if (isLoading) {
    actions = <RuleActionsSkeleton />;
  } else if (fullRule) {
    actions = <AlertRuleActions rule={fullRule} />;
  }

  return (
    <AlertRuleRow
      searchHit={searchHit}
      folderPath={folderPath}
      rule={fullRule}
      sequence={sequence}
      onSequenceClick={() =>
        sequence && openRuleSequence({ sequenceUid: sequence.uid, ruleKind: 'alert', ruleUid: searchHit.uid })
      }
      actions={actions}
    />
  );
}
