import { useCallback, useMemo, useState } from 'react';

import { locationService } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';
import { dispatch } from 'app/store/store';
import { EditableRuleIdentifier, RuleGroupIdentifierV2 } from 'app/types/unified-alerting';

import { shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import { useDeleteRuleFromGroup } from '../../hooks/ruleGroup/useDeleteRuleFromGroup';
import { usePrometheusConsistencyCheck } from '../../hooks/usePrometheusConsistencyCheck';
import { fetchPromAndRulerRulesAction, fetchRulerRulesAction } from '../../state/actions';
import { ruleGroupIdentifierV2toV1 } from '../../utils/groupIdentifier';
import { isCloudRuleIdentifier } from '../../utils/rules';

type DeleteModalHook = [
  JSX.Element,
  (ruleIdentifier: EditableRuleIdentifier, groupIdentifier: RuleGroupIdentifierV2) => void,
  () => void,
];
type DeleteRuleInfo = { ruleIdentifier: EditableRuleIdentifier; groupIdentifier: RuleGroupIdentifierV2 } | undefined;

const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();

export const useDeleteModal = (redirectToListView = false): DeleteModalHook => {
  const [ruleToDelete, setRuleToDelete] = useState<DeleteRuleInfo>();
  const [deleteRuleFromGroup] = useDeleteRuleFromGroup();
  const { waitForRemoval } = usePrometheusConsistencyCheck();

  const dismissModal = useCallback(() => {
    setRuleToDelete(undefined);
  }, []);

  const showModal = useCallback((ruleIdentifier: EditableRuleIdentifier, groupIdentifier: RuleGroupIdentifierV2) => {
    setRuleToDelete({ ruleIdentifier, groupIdentifier });
  }, []);

  const deleteRule = useCallback(async () => {
    if (!ruleToDelete) {
      return;
    }

    const { ruleIdentifier, groupIdentifier } = ruleToDelete;

    const groupIdentifierV1 = ruleGroupIdentifierV2toV1(groupIdentifier);
    const rulesSourceName = groupIdentifierV1.dataSourceName;

    await deleteRuleFromGroup.execute(groupIdentifierV1, ruleIdentifier);

    // refetch rules for this rules source
    // @TODO remove this when we moved everything to RTKQ – then the endpoint will simply invalidate the tags
    dispatch(fetchPromAndRulerRulesAction({ rulesSourceName }));

    if (prometheusRulesPrimary && isCloudRuleIdentifier(ruleIdentifier)) {
      await waitForRemoval(ruleIdentifier);
    } else {
      // Without this the delete popup will close and the user will still see the deleted rule
      await dispatch(fetchRulerRulesAction({ rulesSourceName }));
    }

    dismissModal();

    if (redirectToListView) {
      locationService.replace('/alerting/list');
    }
  }, [deleteRuleFromGroup, dismissModal, ruleToDelete, redirectToListView, waitForRemoval]);

  const modal = useMemo(
    () => (
      <ConfirmModal
        isOpen={Boolean(ruleToDelete)}
        title="Delete rule"
        body="Deleting this rule will permanently remove it from your alert rule list. Are you sure you want to delete this rule?"
        confirmText="Yes, delete"
        icon="exclamation-triangle"
        onConfirm={deleteRule}
        onDismiss={dismissModal}
      />
    ),
    [ruleToDelete, deleteRule, dismissModal]
  );

  return [modal, showModal, dismissModal];
};
