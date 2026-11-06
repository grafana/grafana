import { useGetRecordingRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { RuleActionsSkeleton } from '../../rule-list/components/RuleActionsSkeleton';
import { useFolderPath } from '../folder-browsing/folderLookups';

import { RecordingRuleActions } from './RecordingRuleActions';
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
  const { data: fullRule, isLoading } = useGetRecordingRuleQuery({ name: searchHit.uid });

  let actions = null;
  if (isLoading) {
    actions = <RuleActionsSkeleton />;
  } else if (fullRule) {
    actions = <RecordingRuleActions rule={fullRule} />;
  }

  return <RecordingRuleRow searchHit={searchHit} folderPath={folderPath} rule={fullRule} actions={actions} />;
}
