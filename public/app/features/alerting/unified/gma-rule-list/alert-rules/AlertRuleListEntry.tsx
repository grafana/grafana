import { useFolderPath } from '../folder-browsing/folderLookups';
import { useFullAlertRuleState } from '../rule-data/ruleResourceLookups';

import { AlertRuleActions } from './AlertRuleActions';
import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleListEntryProps {
  hit: AlertRuleSearchHit;
  /** List mode only: Folders mode already shows the folder on the folder row. */
  showFolderPath: boolean;
}

/**
 * Performs the per-rule lookups once and hands the results to the row and its actions, which stay
 * presentation-only. Both lookups are deduplicated RTK Query queries; any future limit on how many
 * rows fetch at once belongs here.
 */
export function AlertRuleListEntry({ hit, showFolderPath }: AlertRuleListEntryProps) {
  const fullRule = useFullAlertRuleState(hit.uid);
  const folderPath = useFolderPath(showFolderPath ? hit.folderUid : undefined);

  return (
    <AlertRuleRow
      hit={hit}
      fullRule={fullRule}
      folderPath={folderPath}
      actions={<AlertRuleActions ruleUid={hit.uid} resourceState={fullRule} />}
    />
  );
}
