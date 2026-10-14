import { useFolderPath } from '../folder-browsing/folderLookups';
import { useFullRecordingRuleState } from '../rule-data/ruleResourceLookups';

import { RecordingRuleActions } from './RecordingRuleActions';
import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleListEntryProps {
  hit: RecordingRuleSearchHit;
  /** List mode only: Folders mode already shows the folder on the folder row. */
  showFolderPath: boolean;
}

/**
 * Performs the per-rule lookups once and hands the results to the row and its actions, which stay
 * presentation-only. Both lookups are deduplicated RTK Query queries; any future limit on how many
 * rows fetch at once belongs here.
 */
export function RecordingRuleListEntry({ hit, showFolderPath }: RecordingRuleListEntryProps) {
  const fullRule = useFullRecordingRuleState(hit.uid);
  const folderPath = useFolderPath(showFolderPath ? hit.folderUid : undefined);

  return (
    <RecordingRuleRow
      hit={hit}
      fullRule={fullRule}
      folderPath={folderPath}
      actions={<RecordingRuleActions ruleUid={hit.uid} resourceState={fullRule} />}
    />
  );
}
