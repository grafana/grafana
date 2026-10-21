import { useFolderPath } from '../folder-browsing/folderLookups';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleListEntryProps {
  hit: RecordingRuleSearchHit;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function RecordingRuleListEntry({ hit }: RecordingRuleListEntryProps) {
  const folderPath = useFolderPath(hit.folderUid);

  return <RecordingRuleRow hit={hit} folderPath={folderPath} />;
}
