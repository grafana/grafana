import { useState, useCallback, useMemo } from 'react';

import { locationService } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';
import { dispatch } from 'app/store/store';
import { CombinedRule } from 'app/types/unified-alerting';

import { shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import { useDeleteRuleFromGroup } from '../../hooks/ruleGroup/useDeleteRuleFromGroup';
import { usePrometheusConsistencyCheck } from '../../hooks/usePrometheusConsistencyCheck';
import { fetchPromAndRulerRulesAction, fetchRulerRulesAction } from '../../state/actions';
import { fromRulerRuleAndRuleGroupIdentifier } from '../../utils/rule-id';
import { getRuleGroupLocationFromCombinedRule, isCloudRuleIdentifier } from '../../utils/rules';

type DeleteModalHook = [JSX.Element, (rule: CombinedRule) => void, () => void];

const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();

export const useDeleteModal = (redirectToListView = false): DeleteModalHook => {
  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule | undefined>();
  const [deleteRuleFromGroup] = useDeleteRuleFromGroup();
  const { waitForRemoval } = usePrometheusConsistencyCheck();

  const dismissModal = useCallback(() => {
    setRuleToDelete(undefined);
  }, []);

  const showModal = useCallback((rule: CombinedRule) => {
    setRuleToDelete(rule);
  }, []);

  const deleteRule = useCallback(
    async (rule?: CombinedRule) => {
      if (!rule?.rulerRule) {
        return;
      }

      const ruleGroupIdentifier = getRuleGroupLocationFromCombinedRule(rule);
      const ruleIdentifier = fromRulerRuleAndRuleGroupIdentifier(ruleGroupIdentifier, rule.rulerRule);

      await deleteRuleFromGroup.execute(ruleGroupIdentifier, ruleIdentifier);

      // refetch rules for this rules source
      // @TODO remove this when we moved everything to RTKQ – then the endpoint will simply invalidate the tags
      dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: ruleGroupIdentifier.dataSourceName }));

      if (prometheusRulesPrimary && isCloudRuleIdentifier(ruleIdentifier)) {
        await waitForRemoval(ruleIdentifier);
      } else {
        // Without this the delete popup will close and the user will still see the deleted rule
        await dispatch(fetchRulerRulesAction({ rulesSourceName: ruleGroupIdentifier.dataSourceName }));
      }

      dismissModal();

      if (redirectToListView) {
        locationService.replace('/alerting/list');
      }
    },
    [deleteRuleFromGroup, dismissModal, redirectToListView, waitForRemoval]
  );

  const modal = useMemo(
    () => (
      <ConfirmModal
        isOpen={Boolean(ruleToDelete)}
        title="Delete rule"
        body="Deleting this rule will permanently remove it from your alert rule list. Are you sure you want to delete this rule?"
        confirmText="Yes, delete"
        icon="exclamation-triangle"
        onConfirm={() => deleteRule(ruleToDelete)}
        onDismiss={dismissModal}
      />
    ),
    [deleteRule, dismissModal, ruleToDelete]
  );

  return [modal, showModal, dismissModal];
};
