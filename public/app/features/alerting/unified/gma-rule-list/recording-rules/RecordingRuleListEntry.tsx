import { useFolderPath } from '../folder-browsing/folderLookups';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleListEntryProps {
  searchHit: RecordingRuleSearchHit;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function RecordingRuleListEntry({ searchHit }: RecordingRuleListEntryProps) {
  const folderPath = useFolderPath(searchHit.folderUid);

  return <RecordingRuleRow searchHit={searchHit} folderPath={folderPath} />;
}
