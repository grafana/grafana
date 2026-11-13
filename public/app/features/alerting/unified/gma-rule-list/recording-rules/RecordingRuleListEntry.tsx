import { useGetRecordingRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { useFolderPath } from '../folder-browsing/folderLookups';
import { useOpenRuleSequence } from '../rule-sequences/RuleSequenceDrawer';
import { useRuleSequenceMembership } from '../rule-sequences/ruleSequenceMembership';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleListEntryProps {
  searchHit: RecordingRuleSearchHit;
  /** List mode only; Folders mode shows the folder on the folder row. */
  showFolderPath: boolean;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function RecordingRuleListEntry({ searchHit, showFolderPath }: RecordingRuleListEntryProps) {
  const folderPath = useFolderPath(showFolderPath ? searchHit.folderUid : undefined);
  const { data: fullRule } = useGetRecordingRuleQuery({ name: searchHit.uid });
  const { sequence } = useRuleSequenceMembership('recording', searchHit.uid);
  const openRuleSequence = useOpenRuleSequence();

  return (
    <RecordingRuleRow
      searchHit={searchHit}
      folderPath={folderPath}
      rule={fullRule}
      sequence={sequence}
      onSequenceClick={() =>
        sequence && openRuleSequence({ sequenceUid: sequence.uid, ruleKind: 'recording', ruleUid: searchHit.uid })
      }
    />
  );
}
