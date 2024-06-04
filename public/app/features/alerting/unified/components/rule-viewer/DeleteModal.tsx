import React, { useState, useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';

import { ConfirmModal } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';

import { useDeleteRuleFromGroup } from '../../hooks/useProduceNewEvaluationGroup';
import { getRuleGroupLocation } from '../../utils/rules';

type DeleteModalHook = [JSX.Element, (rule: CombinedRule) => void, () => void];

export const useDeleteModal = (): DeleteModalHook => {
  const history = useHistory();
  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule | undefined>();
  const [deleteRuleFromGroup, _deleteState] = useDeleteRuleFromGroup();

  const dismissModal = useCallback(() => {
    setRuleToDelete(undefined);
  }, []);

  const showModal = useCallback((rule: CombinedRule) => {
    setRuleToDelete(rule);
  }, []);

  const deleteRule = useCallback(
    async (rule?: CombinedRule, redirect = true) => {
      if (!rule?.rulerRule) {
        return;
      }

      const location = getRuleGroupLocation(rule);
      await deleteRuleFromGroup(location, rule.rulerRule);

      dismissModal();

      // @TODO implement redirect yes / no
      if (redirect) {
        history.push('/alerting/list');
      }
    },
    [deleteRuleFromGroup, dismissModal, history]
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
