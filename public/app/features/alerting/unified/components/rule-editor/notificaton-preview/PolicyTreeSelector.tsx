import { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Field, Select, Stack, Text, TextLink } from '@grafana/ui';
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
 * PolicyTreeSelector - A dropdown to select the notification policy tree for an alert rule.
 *
 * When multiple policies are enabled, this component allows users to select which policy tree
 * should handle the routing for the alert rule. The selection is stored as a label
 * `__grafana_managed_route__` on the rule.
 *
 * - For new rules: defaults to the default policy (empty value for user-defined)
 * - For existing rules: pre-selects based on the existing label value
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

  // Build options from available policies, filtering out duplicate defaults
  const policyOptions: Array<SelectableValue<string>> = useMemo(() => {
    if (!policies) {
      return [];
    }

    // Track if we've already added the default policy option
    let defaultPolicyAdded = false;
    const options: Array<SelectableValue<string>> = [];

    for (const policy of policies) {
      const isDefault = isDefaultPolicy(policy);

      // Skip if this is another default policy entry (avoid duplicates)
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
              'Alert instances will be routed using the default Grafana notification policy'
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

    // If no existing label, nothing to validate
    if (!existingLabel) {
      return;
    }

    // Check if the label value corresponds to an existing policy
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

  const updatePolicyLabel = (newValue: string) => {
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
  };

  const handlePolicyChange = (option: SelectableValue<string>) => {
    const newValue = option.value ?? '';
    updatePolicyLabel(newValue);
  };

  if (error) {
    return null; // Silently fail - the user can still use the form without this feature
  }

  return (
    <Box marginBottom={2}>
      <Stack direction="column" gap={1}>
        <Text element="h5">
          <Trans i18nKey="alerting.policy-tree-selector.title">Notification policy</Trans>
        </Text>
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
          <TextLink
            href={ALERTING_PATHS.ROUTES}
            external
            aria-label={t('alerting.policy-tree-selector.view-policies-aria', 'View notification policies')}
          >
            <Trans i18nKey="alerting.policy-tree-selector.view-policies">View policies</Trans>
          </TextLink>
        </Stack>
      </Stack>
    </Box>
  );
}
