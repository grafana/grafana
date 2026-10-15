import { useFolderPath } from '../folder-browsing/folderLookups';
import { useFullAlertRuleState } from '../rule-data/ruleResourceLookups';

import { AlertRuleActions } from './AlertRuleActions';
import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleListEntryProps {
  hit: AlertRuleSearchHit;
  /** List mode only; Folders mode shows the folder on the folder row. */
  showFolderPath: boolean;
}

/** Runs the per-rule lookups once so the row and its actions stay presentation-only. */
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
