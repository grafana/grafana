import { useFolderPath } from '../folder-browsing/folderLookups';
import { useFullRecordingRuleState } from '../rule-data/ruleResourceLookups';

import { RecordingRuleActions } from './RecordingRuleActions';
import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleListEntryProps {
  searchHit: RecordingRuleSearchHit;
  /** List mode only; Folders mode shows the folder on the folder row. */
  showFolderPath: boolean;
}

/** Runs the per-rule lookups once so the row and its actions stay presentation-only. */
export function RecordingRuleListEntry({ searchHit, showFolderPath }: RecordingRuleListEntryProps) {
  const fullRule = useFullRecordingRuleState(searchHit.uid);
  const folderPath = useFolderPath(showFolderPath ? searchHit.folderUid : undefined);

  return (
    <RecordingRuleRow
      searchHit={searchHit}
      fullRule={fullRule}
      folderPath={folderPath}
      actions={<RecordingRuleActions ruleUid={searchHit.uid} resourceState={fullRule} />}
    />
  );
}
