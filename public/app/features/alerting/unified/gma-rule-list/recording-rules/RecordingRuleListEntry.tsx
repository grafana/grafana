import { useFolderPath } from '../folder-browsing/folderLookups';
import { useFullRecordingRuleState } from '../rule-data/ruleResourceLookups';

import { RecordingRuleActions } from './RecordingRuleActions';
import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleListEntryProps {
  hit: RecordingRuleSearchHit;
  /** List mode only; Folders mode shows the folder on the folder row. */
  showFolderPath: boolean;
}

/** Runs the per-rule lookups once so the row and its actions stay presentation-only. */
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
