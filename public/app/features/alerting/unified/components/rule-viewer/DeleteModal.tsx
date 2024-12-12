import { useCallback, useMemo, useState } from 'react';

import { locationService } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';
import { dispatch } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import { useDeleteRuleFromGroup } from '../../hooks/ruleGroup/useDeleteRuleFromGroup';
import { usePrometheusConsistencyCheck } from '../../hooks/usePrometheusConsistencyCheck';
import { fetchPromAndRulerRulesAction, fetchRulerRulesAction } from '../../state/actions';
import { fromRulerRuleAndRuleGroupIdentifier } from '../../utils/rule-id';
import { isCloudRuleIdentifier } from '../../utils/rules';

type DeleteModalHook = [JSX.Element, (rule: RulerRuleDTO, groupIdentifier: RuleGroupIdentifier) => void, () => void];
type DeleteRuleInfo = { rule: RulerRuleDTO; groupIdentifier: RuleGroupIdentifier } | undefined;

const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();

export const useDeleteModal = (redirectToListView = false): DeleteModalHook => {
  const [ruleToDelete, setRuleToDelete] = useState<DeleteRuleInfo>();
  const [deleteRuleFromGroup] = useDeleteRuleFromGroup();
  const { waitForRemoval } = usePrometheusConsistencyCheck();

  const dismissModal = useCallback(() => {
    setRuleToDelete(undefined);
  }, []);

  const showModal = useCallback((rule: RulerRuleDTO, groupIdentifier: RuleGroupIdentifier) => {
    setRuleToDelete({ rule, groupIdentifier });
  }, []);

  const deleteRule = useCallback(async () => {
    if (!ruleToDelete) {
      return;
    }

    const { rule, groupIdentifier } = ruleToDelete;

    const ruleIdentifier = fromRulerRuleAndRuleGroupIdentifier(groupIdentifier, rule);
    await deleteRuleFromGroup.execute(groupIdentifier, ruleIdentifier);

    // refetch rules for this rules source
    // @TODO remove this when we moved everything to RTKQ – then the endpoint will simply invalidate the tags
    dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: groupIdentifier.dataSourceName }));

    if (prometheusRulesPrimary && isCloudRuleIdentifier(ruleIdentifier)) {
      await waitForRemoval(ruleIdentifier);
    } else {
      // Without this the delete popup will close and the user will still see the deleted rule
      await dispatch(fetchRulerRulesAction({ rulesSourceName: groupIdentifier.dataSourceName }));
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
