import { useGetAlertRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { useFolderPath } from '../folder-browsing/folderLookups';
import { RuleBadge } from '../rule-row/RuleBadge';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleListEntryProps {
  searchHit: AlertRuleSearchHit;
}

/** Runs the per-rule lookups once so the row stays presentation-only. */
export function AlertRuleListEntry({ searchHit }: AlertRuleListEntryProps) {
  const folderPath = useFolderPath(searchHit.folderUid);
  const { data: fullRule } = useGetAlertRuleQuery({ name: searchHit.uid });
  const badge = fullRule ? <RuleBadge rule={fullRule} /> : undefined;

  return <AlertRuleRow searchHit={searchHit} folderPath={folderPath} badge={badge} />;
}
