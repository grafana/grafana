import { DeletedRuleReviewDrawer } from '../../recently-deleted/DeletedRuleReviewDrawer';
import { DeletedRulesTable } from '../../recently-deleted/DeletedRulesTable';
import { useTrackDeletedRulesPage } from '../../recently-deleted/useTrackDeletedRulesPage';

import { useDeletedAlertRules } from './alertRulesTrash';

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
