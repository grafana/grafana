import { useFolderPath } from '../folder-browsing/folderLookups';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleListEntryProps {
  hit: AlertRuleSearchHit;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function AlertRuleListEntry({ hit }: AlertRuleListEntryProps) {
  const folderPath = useFolderPath(hit.folderUid);

  return <AlertRuleRow hit={hit} folderPath={folderPath} />;
}
