import React, { useState, useCallback, useMemo } from 'react';

import { ConfirmModal } from '@grafana/ui';
import { dispatch } from 'app/store/store';
import { CombinedRule } from 'app/types/unified-alerting';

import { deleteRuleAction } from '../../../state/actions';
import { getRulesSourceName } from '../../../utils/datasource';
import { fromRulerRule } from '../../../utils/rule-id';

type DeleteModalHook = [JSX.Element, (rule: CombinedRule) => void, () => void];

export const useDeleteModal = (): DeleteModalHook => {
  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule | undefined>();

  const dismissModal = useCallback(() => {
    setRuleToDelete(undefined);
  }, []);

  const showModal = useCallback((rule: CombinedRule) => {
    setRuleToDelete(rule);
  }, []);

  const deleteRule = useCallback(
    (ruleToDelete?: CombinedRule) => {
      if (ruleToDelete && ruleToDelete.rulerRule) {
        const identifier = fromRulerRule(
          getRulesSourceName(ruleToDelete.namespace.rulesSource),
          ruleToDelete.namespace.name,
          ruleToDelete.group.name,
          ruleToDelete.rulerRule
        );

        dispatch(deleteRuleAction(identifier, { navigateTo: '/alerting/list' }));
        dismissModal();
      }
    },
    [dismissModal]
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
