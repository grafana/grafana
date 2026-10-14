import { DeletedRuleReviewDrawer } from '../../recently-deleted/DeletedRuleReviewDrawer';
import { DeletedRulesTable } from '../../recently-deleted/DeletedRulesTable';
import { useTrackDeletedRulesPage } from '../../recently-deleted/useTrackDeletedRulesPage';

import { useDeletedAlertRules } from './alertRulesTrash';

/**
 * Recently deleted page body for Grafana-managed Alert rules.
 * FE-platform mounts this inside the routed page/tab shell - this component owns only the data
 * fetch, table, and Review drawer.
 */
export function AlertRulesRecentlyDeleted() {
  const deleted = useDeletedAlertRules();
  useTrackDeletedRulesPage('alert', deleted);

  return (
    <DeletedRulesTable
      deleted={deleted}
      renderReview={(rule, onClose) => <DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={onClose} />}
    />
  );
}
