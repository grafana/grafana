import { useState, useCallback, useMemo } from 'react';

import { locationService } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';
import { dispatch } from 'app/store/store';
import { CombinedRule } from 'app/types/unified-alerting';

import { useDeleteRuleFromGroup } from '../../hooks/ruleGroup/useDeleteRuleFromGroup';
import { fetchPromAndRulerRulesAction } from '../../state/actions';
import { getRuleGroupLocationFromCombinedRule } from '../../utils/rules';

type DeleteModalHook = [JSX.Element, (rule: CombinedRule) => void, () => void];

export const useDeleteModal = (redirectToListView = false): DeleteModalHook => {
  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule | undefined>();
  const [_deleteState, deleteRuleFromGroup] = useDeleteRuleFromGroup();

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

      const location = getRuleGroupLocationFromCombinedRule(rule);
      await deleteRuleFromGroup.execute(location, rule.rulerRule);

      // refetch rules for this rules source
      // @TODO remove this when we moved everything to RTKQ – then the endpoint will simply invalidate the tags
      dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: location.dataSourceName }));

      dismissModal();

      if (redirectToListView) {
        locationService.replace('/alerting/list');
      }
    },
    [deleteRuleFromGroup, dismissModal, redirectToListView]
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
