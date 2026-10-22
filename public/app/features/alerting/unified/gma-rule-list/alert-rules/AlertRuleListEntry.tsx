import { useFolderPath } from '../folder-browsing/folderLookups';
import { useFullAlertRuleState } from '../rule-data/ruleResourceLookups';

import { AlertRuleActions } from './AlertRuleActions';
import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleListEntryProps {
  searchHit: AlertRuleSearchHit;
  /** List mode only; Folders mode shows the folder on the folder row. */
  showFolderPath: boolean;
}

/** Runs the per-rule lookups once so the row and its actions stay presentation-only. */
export function AlertRuleListEntry({ searchHit, showFolderPath }: AlertRuleListEntryProps) {
  const fullRule = useFullAlertRuleState(searchHit.uid);
  const folderPath = useFolderPath(showFolderPath ? searchHit.folderUid : undefined);

  return (
    <AlertRuleRow
      searchHit={searchHit}
      fullRule={fullRule}
      folderPath={folderPath}
      actions={<AlertRuleActions ruleUid={searchHit.uid} resourceState={fullRule} />}
    />
  );
}
