import { useCallback, useMemo, useState } from 'react';

import { locationService } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { dispatch } from 'app/store/store';
import { EditableRuleIdentifier, RuleGroupIdentifierV2 } from 'app/types/unified-alerting';

import { shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import { useDeleteRulePermanentlyFromGroup } from '../../hooks/ruleGroup/useDeleteRulePermanentlyFromGroup';
import { usePrometheusConsistencyCheck } from '../../hooks/usePrometheusConsistencyCheck';
import { fetchPromAndRulerRulesAction, fetchRulerRulesAction } from '../../state/actions';
import { ruleGroupIdentifierV2toV1 } from '../../utils/groupIdentifier';
import { isCloudRuleIdentifier } from '../../utils/rules';

type DeletePermanentlyModalHook = [
  JSX.Element,
  (ruleIdentifier: EditableRuleIdentifier, groupIdentifier: RuleGroupIdentifierV2) => void,
  () => void,
];
type DeleteRuleInfo = { ruleIdentifier: EditableRuleIdentifier; groupIdentifier: RuleGroupIdentifierV2 } | undefined;

const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();

export const useDeletePermanentlyModal = (redirectToListView = false): DeletePermanentlyModalHook => {
  const [ruleToDelete, setRuleToDelete] = useState<DeleteRuleInfo>();
  const [deleteRulePermanentlyFromGroup] = useDeleteRulePermanentlyFromGroup();
  const { waitForRemoval } = usePrometheusConsistencyCheck();

  const dismissModal = useCallback(() => {
    setRuleToDelete(undefined);
  }, []);

  const showModal = useCallback(
    (ruleIdentifier: EditableRuleIdentifier, groupIdentifier: RuleGroupIdentifierV2, deletePermanently = false) => {
      setRuleToDelete({ ruleIdentifier, groupIdentifier });
    },
    []
  );

  const deleteRule = useCallback(async () => {
    if (!ruleToDelete) {
      return;
    }

    const { ruleIdentifier, groupIdentifier } = ruleToDelete;

    const groupIdentifierV1 = ruleGroupIdentifierV2toV1(groupIdentifier);
    const rulesSourceName = groupIdentifierV1.dataSourceName;

    await deleteRulePermanentlyFromGroup.execute(groupIdentifierV1, ruleIdentifier);
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
  }, [deleteRulePermanentlyFromGroup, dismissModal, ruleToDelete, redirectToListView, waitForRemoval]);

  const modal = useMemo(
    () => (
      <ConfirmModal
        isOpen={Boolean(ruleToDelete)}
        title={t('alerting.delete-permanently-modal-title', 'Delete rule')}
        body={t(
          'alerting.delete-permanently-modal-body',
          'Deleting this rule will permanently remove it from your alert rule list. This rule will not be recoverable.Are you sure you want to delete permanently this rule?'
        )}
        confirmText={t('alerting.delete-permanently-modal-confirm-text', 'Yes, delete permanently')}
        icon="exclamation-triangle"
        onConfirm={() => deleteRule()}
        onDismiss={dismissModal}
      />
    ),
    [ruleToDelete, deleteRule, dismissModal]
  );

  return [modal, showModal, dismissModal];
};
