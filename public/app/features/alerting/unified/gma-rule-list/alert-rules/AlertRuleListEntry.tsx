import { useGetAlertRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { useFolderPath } from '../folder-browsing/folderLookups';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleListEntryProps {
  searchHit: AlertRuleSearchHit;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function AlertRuleListEntry({ searchHit }: AlertRuleListEntryProps) {
  const folderPath = useFolderPath(searchHit.folderUid);
  const { data: fullRule } = useGetAlertRuleQuery({ name: searchHit.uid });

  return <AlertRuleRow searchHit={searchHit} folderPath={folderPath} rule={fullRule} />;
}
