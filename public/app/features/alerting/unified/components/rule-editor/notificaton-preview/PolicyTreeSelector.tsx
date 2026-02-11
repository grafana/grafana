import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Box, Button, Field, Select, Stack, Text, TextLink } from '@grafana/ui';
import { Route } from 'app/plugins/datasource/alertmanager/types';

import { RuleFormValues } from '../../../types/rule-form';
import { ALERTING_PATHS } from '../../../utils/navigation';
import {
  NAMED_ROOT_LABEL_NAME,
  useListNotificationPolicyRoutes,
} from '../../notification-policies/useNotificationPolicyRoute';

/**
 * Check if a policy is the default policy by looking at its object_matchers.
 * The default policy has a matcher for __grafana_managed_route__ with an empty value.
 */
function isDefaultPolicy(policy: Route): boolean {
  return policy.object_matchers?.some(([label, , value]) => label === NAMED_ROOT_LABEL_NAME && value === '') ?? false;
}

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
  const { watch, setValue, getValues } = useFormContext<RuleFormValues>();

  const labels = watch('labels');

  const { currentData: policies, isLoading, error } = useListNotificationPolicyRoutes();

  // Get current value from labels
  const currentPolicyValue = useMemo(() => {
    const existingLabel = labels.find((label) => label.key === NAMED_ROOT_LABEL_NAME);
    return existingLabel?.value ?? '';
  }, [labels]);

  const isUsingDefaultPolicy = currentPolicyValue === '';

  // Expanded state: collapsed when using default policy, expanded when custom policy is selected
  const [isExpanded, setIsExpanded] = useState(!isUsingDefaultPolicy);

  // Sync expanded state when policy changes externally (e.g. loading existing rule)
  useEffect(() => {
    if (!isLoading) {
      setIsExpanded(!isUsingDefaultPolicy);
    }
  }, [isUsingDefaultPolicy, isLoading]);

  // Build options from available policies, filtering out duplicate defaults
  const policyOptions: Array<SelectableValue<string>> = useMemo(() => {
    if (!policies) {
      return [];
    }

    let defaultPolicyAdded = false;
    const options: Array<SelectableValue<string>> = [];

    for (const policy of policies) {
      const isDefault = isDefaultPolicy(policy);

      if (isDefault && defaultPolicyAdded) {
        continue;
      }

      if (isDefault) {
        defaultPolicyAdded = true;
      }

      options.push({
        label: isDefault ? t('alerting.policy-tree-selector.default-policy', 'Default policy') : (policy.name ?? ''),
        value: isDefault ? '' : (policy.name ?? ''),
        description: isDefault
          ? t(
              'alerting.policy-tree-selector.default-policy-desc',
              'Routes alerts using the default notification policy tree'
            )
          : t('alerting.policy-tree-selector.custom-policy-desc', 'Route alerts through the {{name}} policy tree', {
              name: policy.name,
            }),
      });
    }

    return options;
  }, [policies]);

  // Validate that existing label value is still valid when policies load
  useEffect(() => {
    if (isLoading || !policies || policies.length === 0) {
      return;
    }

    const existingLabel = labels.find((label) => label.key === NAMED_ROOT_LABEL_NAME);

    if (!existingLabel) {
      return;
    }

    const labelValue = existingLabel.value;
    const policyExists = policies.some((p) => {
      if (isDefaultPolicy(p)) {
        return labelValue === '';
      }
      return p.name === labelValue;
    });

    // Policy no longer exists, reset to default by removing the label
    if (!policyExists) {
      const newLabels = labels.filter((label) => label.key !== NAMED_ROOT_LABEL_NAME);
      setValue('labels', newLabels);
    }
  }, [isLoading, policies, labels, setValue]);

  const updatePolicyLabel = useCallback(
    (newValue: string) => {
      const currentLabels = getValues('labels');
      const existingLabelIndex = currentLabels.findIndex((label) => label.key === NAMED_ROOT_LABEL_NAME);

      let newLabels = [...currentLabels];

      if (newValue === '') {
        // If selecting default policy (empty value), remove the label entirely
        if (existingLabelIndex !== -1) {
          newLabels.splice(existingLabelIndex, 1);
        }
      } else {
        // Add or update the label
        if (existingLabelIndex !== -1) {
          newLabels[existingLabelIndex] = { key: NAMED_ROOT_LABEL_NAME, value: newValue };
        } else {
          newLabels = [...newLabels, { key: NAMED_ROOT_LABEL_NAME, value: newValue }];
        }
      }

      setValue('labels', newLabels);
    },
    [getValues, setValue]
  );

  const handlePolicyChange = (option: SelectableValue<string>) => {
    const newValue = option.value ?? '';
    updatePolicyLabel(newValue);

    // If user selects default, collapse back
    if (newValue === '') {
      setIsExpanded(false);
    }
  };

  const handleResetToDefault = () => {
    updatePolicyLabel('');
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
                <Select
                  inputId="policy-tree-selector"
                  aria-label={t('alerting.policy-tree-selector.aria-label', 'Select notification policy')}
                  options={policyOptions}
                  value={currentPolicyValue}
                  onChange={handlePolicyChange}
                  isLoading={isLoading}
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
