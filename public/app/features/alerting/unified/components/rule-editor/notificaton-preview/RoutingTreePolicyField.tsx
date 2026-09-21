import { useCallback, useEffect, useMemo, useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';

import { RoutingTreePicker, isDefaultRoutingTreeName, useListRoutingTrees } from '@grafana/alerting/unstable';
import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { config } from '@grafana/runtime';
import { Box } from '@grafana/ui';

import { type RuleFormValues } from '../../../types/rule-form';
import { ALERTING_PATHS } from '../../../utils/navigation';
import { NAMED_ROOT_LABEL_NAME } from '../../notification-policies/useNotificationPolicyRoute';

/**
 * Bridges RuleFormValues' policy-name string (selectedPolicy, or the legacy
 * __grafana_managed_route__ label) to RoutingTreePicker's RoutingTree | null contract.
 *
 * A rule already routed via notification_settings.policy keeps editing through that field even
 * if the toggle is later turned off, so the two routing mechanisms never coexist on one rule.
 */
export function RoutingTreePolicyField() {
  const usePolicyRoutingSettings = config.featureToggles.alertingPolicyRoutingSettings;
  const { watch, setValue, getValues, control } = useFormContext<RuleFormValues>();

  const labels = watch('labels');
  const { field: selectedPolicyField } = useController({ name: 'selectedPolicy', control, defaultValue: '' });

  const [isPolicyFieldRule] = useState(
    () =>
      Boolean(usePolicyRoutingSettings) ||
      (Boolean(selectedPolicyField.value) && !labels.some((label) => label.key === NAMED_ROOT_LABEL_NAME))
  );

  const currentPolicyName = useMemo(() => {
    if (isPolicyFieldRule) {
      return selectedPolicyField.value || '';
    }
    return labels.find((label) => label.key === NAMED_ROOT_LABEL_NAME)?.value || '';
  }, [isPolicyFieldRule, selectedPolicyField.value, labels]);

  const { currentData: routingTrees, isLoading, isError } = useListRoutingTrees();

  const selectedTree = useMemo(() => {
    if (!currentPolicyName) {
      return null;
    }
    return routingTrees?.items.find((tree) => tree.metadata.name === currentPolicyName) ?? null;
  }, [currentPolicyName, routingTrees]);

  const updatePolicyValue = useCallback(
    (newValue: string) => {
      if (isPolicyFieldRule) {
        selectedPolicyField.onChange(newValue);
        return;
      }

      const currentLabels = getValues('labels');
      const existingLabelIndex = currentLabels.findIndex((label) => label.key === NAMED_ROOT_LABEL_NAME);
      let newLabels = [...currentLabels];

      if (newValue === '') {
        if (existingLabelIndex !== -1) {
          newLabels.splice(existingLabelIndex, 1);
        }
      } else if (existingLabelIndex !== -1) {
        newLabels[existingLabelIndex] = { key: NAMED_ROOT_LABEL_NAME, value: newValue };
      } else {
        newLabels = [...newLabels, { key: NAMED_ROOT_LABEL_NAME, value: newValue }];
      }

      setValue('labels', newLabels);
    },
    [isPolicyFieldRule, selectedPolicyField, getValues, setValue]
  );

  // Legacy label path only: once the tree list has loaded, drop a stale label pointing at a
  // policy tree that no longer exists rather than keep the form pinned to a dead reference.
  useEffect(() => {
    if (isPolicyFieldRule || isLoading || !routingTrees || !currentPolicyName) {
      return;
    }
    const stillExists =
      isDefaultRoutingTreeName(currentPolicyName) ||
      routingTrees.items.some((tree) => tree.metadata.name === currentPolicyName);
    if (!stillExists) {
      updatePolicyValue('');
    }
  }, [isPolicyFieldRule, isLoading, routingTrees, currentPolicyName, updatePolicyValue]);

  const handleChange = (tree: RoutingTree | null) => {
    updatePolicyValue(tree?.metadata.name ?? '');
  };

  // A failed fetch would otherwise resolve selectedTree to null, silently showing "Default policy"
  // for a rule that's actually routed through a custom tree we just couldn't confirm.
  if (isError) {
    return null;
  }

  return (
    <Box marginBottom={2}>
      <RoutingTreePicker value={selectedTree} onChange={handleChange} viewPoliciesHref={ALERTING_PATHS.ROUTES} />
    </Box>
  );
}
