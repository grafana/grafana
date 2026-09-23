import { useEffect, useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';

import {
  RoutingTreeSelector,
  findRoutingTreeByName,
  isDefaultRoutingTree,
  useListRoutingTrees,
} from '@grafana/alerting/unstable';
import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { Trans, t } from '@grafana/i18n';
import { Badge, Box, Button, Field, Icon, Stack, Text, TextLink } from '@grafana/ui';

import { type RuleFormValues } from '../../../types/rule-form';
import { ALERTING_PATHS } from '../../../utils/navigation';

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
 * - A policy that isn't in the dropdown's list is kept and flagged with a warning, rather than
 *   being silently replaced
 */
export function PolicyTreeSelector() {
  const { control } = useFormContext<RuleFormValues>();

  const { field: selectedPolicyField } = useController({
    name: 'selectedPolicy',
    control,
    defaultValue: '',
  });

  // Same query arg as the one RoutingTreeSelector uses internally, so both share a single request.
  const { currentData: routingTrees, isLoading, error } = useListRoutingTrees({});
  const policies = routingTrees?.items;

  // The legacy label is migrated into selectedPolicy (and stripped from labels) at read time
  // (see resolveSelectedPolicyAndLabels in rule-form.ts), so editing always goes through the field.
  const currentPolicyValue = selectedPolicyField.value || '';

  const isUsingDefaultPolicy = currentPolicyValue === '';

  // The rule can name a tree the list doesn't contain. The combobox still shows the name, which on
  // its own is indistinguishable from a valid pick, so warn instead of quietly replacing it - we
  // can't tell a deleted tree from one this user isn't allowed to read, and guessing either way
  // would mean rewriting someone's routing behind their back.
  const isPolicyMissingFromList =
    !isLoading &&
    Boolean(policies?.length) &&
    !isUsingDefaultPolicy &&
    !findRoutingTreeByName(policies ?? [], currentPolicyValue);

  // Expanded state: collapsed when using default policy, expanded when custom policy is selected
  const [isExpanded, setIsExpanded] = useState(!isUsingDefaultPolicy);

  // Sync expanded state when policy changes externally (e.g. loading existing rule)
  useEffect(() => {
    if (!isLoading) {
      setIsExpanded(!isUsingDefaultPolicy);
    }
  }, [isUsingDefaultPolicy, isLoading]);

  const handlePolicyChange = (tree: RoutingTree) => {
    const isDefault = isDefaultRoutingTree(tree);
    // Pass '' (not undefined) for the default policy: react-hook-form's controller onChange ignores
    // undefined, leaving the previous policy in place. '' is the field's default and reads as the
    // default policy.
    selectedPolicyField.onChange(isDefault ? '' : (tree.metadata.name ?? ''));

    if (isDefault) {
      setIsExpanded(false);
    }
  };

  const handleChangeClick = () => {
    setIsExpanded(true);
  };

  // Only hide the section when we have no list at all. RoutingTreeSelector refetches this same
  // query on mount and on window focus, and a failed refetch sets error while the last good list is
  // still cached - bailing out then would make the whole policy section vanish mid-edit.
  if (error && !policies) {
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
              <TextLink
                href={ALERTING_PATHS.ROUTES}
                external
                aria-label={t('alerting.policy-tree-selector.view-policies-aria', 'View notification policies')}
              >
                <Trans i18nKey="alerting.policy-tree-selector.view-policies">View policies</Trans>
              </TextLink>
            </Stack>
            {isPolicyMissingFromList && (
              <Stack direction="row" gap={0.5} alignItems="center">
                <Icon name="exclamation-triangle" size="sm" />
                <Text color="warning" variant="bodySmall">
                  <Trans i18nKey="alerting.policy-tree-selector.missing-policy">
                    This policy tree is not in your list. It may have been deleted, or you may not have permission to
                    view it. It stays assigned to this rule unless you pick a different one.
                  </Trans>
                </Text>
              </Stack>
            )}
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
