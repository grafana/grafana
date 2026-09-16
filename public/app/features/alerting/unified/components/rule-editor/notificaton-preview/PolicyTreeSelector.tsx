import { useCallback, useEffect, useMemo, useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';

import { RoutingTreeSelector, isDefaultRoutingTree, useListRoutingTrees } from '@grafana/alerting/unstable';
import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Badge, Box, Button, Field, Stack, Text, TextLink } from '@grafana/ui';

import { type RuleFormValues } from '../../../types/rule-form';
import { ALERTING_PATHS } from '../../../utils/navigation';
import {
  getLegacyPolicyLabelValue,
  isEditingViaPolicyField,
  isLegacyPolicyLabelStale,
  setLegacyPolicyLabelValue,
} from '../../notification-policies/useNotificationPolicyRoute';

/**
 * PolicyTreeSelector - A component to select the notification policy tree for an alert rule.
 *
 * When multiple policies are enabled, this component allows users to select which policy tree
 * should handle the routing for the alert rule. The selection is stored as a label
 * `__grafana_managed_route__` on the rule.
 *
 * UX behavior:
 * - For new rules or rules using the default policy: shows a collapsed view with a "Change" button
 * - For existing rules with a custom policy: shows the dropdown directly
 * - A "Reset to default" button allows quickly returning to the default policy
 */
export function PolicyTreeSelector() {
  const usePolicyRoutingSettings = config.featureToggles.alertingPolicyRoutingSettings;

  const { watch, setValue, getValues, control } = useFormContext<RuleFormValues>();

  const labels = watch('labels');

  const { field: selectedPolicyField } = useController({
    name: 'selectedPolicy',
    control,
    defaultValue: '',
  });

  const { currentData: routingTrees, isLoading, error } = useListRoutingTrees();
  const policies = routingTrees?.items;

  const [isPolicyFieldRule] = useState(() =>
    isEditingViaPolicyField(usePolicyRoutingSettings, selectedPolicyField.value, labels)
  );

  // Resolve the current value from the routing mechanism this rule actually uses. Policy-field rules
  // must read selectedPolicy only: the legacy label can linger in form state (it is stripped at DTO
  // time, not on edit), so falling back to it would mask a reset-to-default with the stale value.
  const currentPolicyValue = useMemo(() => {
    if (isPolicyFieldRule) {
      return selectedPolicyField.value || '';
    }
    return getLegacyPolicyLabelValue(labels) || '';
  }, [isPolicyFieldRule, selectedPolicyField.value, labels]);

  const isUsingDefaultPolicy = currentPolicyValue === '';

  // Expanded state: collapsed when using default policy, expanded when custom policy is selected
  const [isExpanded, setIsExpanded] = useState(!isUsingDefaultPolicy);

  // Sync expanded state when policy changes externally (e.g. loading existing rule)
  useEffect(() => {
    if (!isLoading) {
      setIsExpanded(!isUsingDefaultPolicy);
    }
  }, [isUsingDefaultPolicy, isLoading]);

  // Validate that existing label value is still valid when policies load (legacy label path only)
  useEffect(() => {
    if (isPolicyFieldRule) {
      return;
    }
    if (isLoading || !policies || policies.length === 0) {
      return;
    }

    // Policy no longer exists, reset to default by removing the label
    if (isLegacyPolicyLabelStale(labels, policies)) {
      setValue('labels', setLegacyPolicyLabelValue(labels, ''));
    }
  }, [isPolicyFieldRule, isLoading, policies, labels, setValue]);

  const updatePolicyValue = useCallback(
    (newValue: string) => {
      if (isPolicyFieldRule) {
        // Pass '' (not undefined) on reset: react-hook-form's controller onChange ignores undefined,
        // leaving the previous policy in place. '' is the field's default and reads as the default policy.
        selectedPolicyField.onChange(newValue);
        return;
      }

      setValue('labels', setLegacyPolicyLabelValue(getValues('labels'), newValue));
    },
    [isPolicyFieldRule, selectedPolicyField, getValues, setValue]
  );

  const handlePolicyChange = (tree: RoutingTree) => {
    const isDefault = isDefaultRoutingTree(tree);
    const newValue = isDefault ? '' : (tree.metadata.name ?? '');

    updatePolicyValue(newValue);

    if (isDefault) {
      setIsExpanded(false);
    }
  };

  const handleResetToDefault = () => {
    updatePolicyValue('');
    setIsExpanded(false);
  };

  const handleChangeClick = () => {
    setIsExpanded(true);
  };

  if (error) {
    return null; // Silently fail - the user can still use the form without this feature
  }

  return (
    <Box marginBottom={2}>
      <Stack direction="column" gap={1}>
        {isExpanded ? (
          // Expanded: show the dropdown
          <>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="alerting.policy-tree-selector.description">
                Select which notification policy tree should handle routing for this alert rule.
              </Trans>
            </Text>
            <Stack direction="row" gap={1} alignItems="center">
              <Field noMargin>
                <RoutingTreeSelector
                  id="policy-tree-selector"
                  aria-label={t('alerting.policy-tree-selector.aria-label', 'Select notification policy')}
                  value={currentPolicyValue}
                  onChange={handlePolicyChange}
                  disabled={isLoading}
                  width={40}
                  placeholder={t('alerting.policy-tree-selector.placeholder', 'Select a policy...')}
                />
              </Field>
              {!isUsingDefaultPolicy && (
                <Button
                  variant="secondary"
                  fill="text"
                  size="sm"
                  icon="history"
                  type="button"
                  onClick={handleResetToDefault}
                  aria-label={t('alerting.policy-tree-selector.reset-aria', 'Reset to default policy')}
                >
                  <Trans i18nKey="alerting.policy-tree-selector.reset">Reset to default</Trans>
                </Button>
              )}
              <TextLink
                href={ALERTING_PATHS.ROUTES}
                external
                aria-label={t('alerting.policy-tree-selector.view-policies-aria', 'View notification policies')}
              >
                <Trans i18nKey="alerting.policy-tree-selector.view-policies">View policies</Trans>
              </TextLink>
            </Stack>
          </>
        ) : (
          // Collapsed: show default policy info with a change button
          <>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="alerting.policy-tree-selector.default-info">
                Alert instances are routed using the default notification policy tree.
              </Trans>
            </Text>
            <Stack direction="row" gap={1} alignItems="center">
              <Badge
                text={t('alerting.policy-tree-selector.default-badge', 'Default policy')}
                color="blue"
                icon="shield"
              />
              <Button
                variant="secondary"
                fill="text"
                size="sm"
                type="button"
                onClick={handleChangeClick}
                disabled={isLoading}
                aria-label={t('alerting.policy-tree-selector.change-aria', 'Change notification policy')}
              >
                <Trans i18nKey="alerting.policy-tree-selector.change">Change</Trans>
              </Button>
              <TextLink
                href={ALERTING_PATHS.ROUTES}
                external
                aria-label={t('alerting.policy-tree-selector.view-policies-aria', 'View notification policies')}
              >
                <Trans i18nKey="alerting.policy-tree-selector.view-policies">View policies</Trans>
              </TextLink>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
