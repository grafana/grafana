import { useCallback, useEffect, useMemo, useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';

import { type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Box, Button, Field, Select, Stack, Text, TextLink } from '@grafana/ui';
import { type Route } from 'app/plugins/datasource/alertmanager/types';

import { type RuleFormValues } from '../../../types/rule-form';
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
 * should handle the routing for the alert rule. The selection is stored via the `selectedPolicy`
 * form field, which is saved to the rule's dedicated notification_settings.policy field.
 *
 * UX behavior:
 * - For new rules or rules using the default policy: shows a collapsed view with a "Change" button
 * - For existing rules with a custom policy: shows the dropdown directly
 * - A "Reset to default" button allows quickly returning to the default policy
 */
export function PolicyTreeSelector() {
  const { control } = useFormContext<RuleFormValues>();

  const { field: selectedPolicyField } = useController({
    name: 'selectedPolicy',
    control,
    defaultValue: '',
  });

  const { currentData: policies, isLoading, error } = useListNotificationPolicyRoutes();

  // The legacy label is migrated into selectedPolicy (and stripped from labels) at read time
  // (see resolveSelectedPolicyAndLabels in rule-form.ts), so editing always goes through the field.
  const currentPolicyValue = selectedPolicyField.value || '';

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

  const updatePolicyValue = useCallback(
    (newValue: string) => {
      // Pass '' (not undefined) on reset: react-hook-form's controller onChange ignores undefined,
      // leaving the previous policy in place. '' is the field's default and reads as the default policy.
      selectedPolicyField.onChange(newValue);
    },
    [selectedPolicyField]
  );

  const handlePolicyChange = (option: SelectableValue<string>) => {
    const newValue = option.value ?? '';

    updatePolicyValue(newValue);

    if (newValue === '') {
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
