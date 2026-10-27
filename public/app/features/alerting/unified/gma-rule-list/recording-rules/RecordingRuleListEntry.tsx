import { useGetRecordingRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { useFolderPath } from '../folder-browsing/folderLookups';
import { RuleBadge } from '../rule-row/RuleBadge';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleListEntryProps {
  searchHit: RecordingRuleSearchHit;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function RecordingRuleListEntry({ searchHit }: RecordingRuleListEntryProps) {
  const folderPath = useFolderPath(searchHit.folderUid);
  const { data: fullRule } = useGetRecordingRuleQuery({ name: searchHit.uid });
  const badge = fullRule ? <RuleBadge rule={fullRule} /> : undefined;

  return <RecordingRuleRow searchHit={searchHit} folderPath={folderPath} badge={badge} />;
}
