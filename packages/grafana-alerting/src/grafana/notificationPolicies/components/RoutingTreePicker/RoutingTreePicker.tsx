import { useEffect, useState } from 'react';

import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, Button, Stack, Text, TextLink } from '@grafana/ui';

import { type Label } from '../../../matchers/types';
import { useMatchInstancesToSpecificRouteTree } from '../../hooks/useMatchPolicies';
import { useListRoutingTrees } from '../../hooks/useRoutingTrees';
import { USER_DEFINED_TREE_NAME, isDefaultRoutingTree } from '../../routingTrees';
import { RoutingTreeSelector } from '../RoutingTreeSelector/RoutingTreeSelector';

export interface RoutingTreePickerProps {
  /** `null` means "use the default policy" - no explicit tree chosen. */
  value: RoutingTree | null;
  onChange: (value: RoutingTree | null) => void;
  /**
   * Alert instance label sets to preview which policy route would receive the notification.
   * Works whether `value` is an explicit tree or `null` (the default policy). Omit to skip the
   * preview entirely.
   */
  instancesToPreview?: Label[][];
  /** Link target for "View policies". Omit to hide the link. */
  viewPoliciesHref?: string;
}

function isUsingDefaultPolicy(value: RoutingTree | null): boolean {
  return value === null || isDefaultRoutingTree(value);
}

/**
 * Lets a caller pick which notification policy tree routes an alert rule, with no dependency on
 * any alert-rule-form context. Mirrors the collapsed/expanded UX of the internal PolicyTreeSelector,
 * built on the exported RoutingTreeSelector primitive instead of the legacy label-based mechanism.
 */
export function RoutingTreePicker({ value, onChange, instancesToPreview, viewPoliciesHref }: RoutingTreePickerProps) {
  const usingDefault = isUsingDefaultPolicy(value);
  const [isExpanded, setIsExpanded] = useState(!usingDefault);

  useEffect(() => {
    setIsExpanded(!usingDefault);
  }, [usingDefault]);

  const handleResetToDefault = () => {
    onChange(null);
    setIsExpanded(false);
  };

  // RoutingTreeSelector always returns the concrete tree object, even for the default-named one.
  // Normalize that case to null so "default" has one representation regardless of whether the
  // caller got there via this dropdown or the Reset button below.
  const handleRoutingTreeSelectorChange = (tree: RoutingTree) => {
    onChange(isDefaultRoutingTree(tree) ? null : tree);
  };

  const viewPoliciesLink = viewPoliciesHref && (
    <TextLink
      href={viewPoliciesHref}
      external
      aria-label={t('alerting.routing-tree-picker.view-policies-aria', 'View notification policies')}
    >
      <Trans i18nKey="alerting.routing-tree-picker.view-policies">View policies</Trans>
    </TextLink>
  );

  return (
    <Stack direction="column" gap={1}>
      {isExpanded ? (
        <>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="alerting.routing-tree-picker.description">
              Select which notification policy tree should handle routing for this alert rule.
            </Trans>
          </Text>
          <Stack direction="row" gap={1} alignItems="center">
            <RoutingTreeSelector
              isClearable={false}
              value={value ? value.metadata.name : USER_DEFINED_TREE_NAME}
              onChange={handleRoutingTreeSelectorChange}
              aria-label={t('alerting.routing-tree-picker.selector-aria', 'Select notification policy')}
            />
            {usingDefault ? (
              <Button
                variant="secondary"
                fill="text"
                size="sm"
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label={t(
                  'alerting.routing-tree-picker.collapse-aria',
                  'Collapse the notification policy selector'
                )}
              >
                <Trans i18nKey="alerting.routing-tree-picker.collapse">Collapse</Trans>
              </Button>
            ) : (
              <Button
                variant="secondary"
                fill="text"
                size="sm"
                icon="history"
                type="button"
                onClick={handleResetToDefault}
                aria-label={t('alerting.routing-tree-picker.reset-aria', 'Reset to default policy')}
              >
                <Trans i18nKey="alerting.routing-tree-picker.reset">Reset to default</Trans>
              </Button>
            )}
            {viewPoliciesLink}
          </Stack>
        </>
      ) : (
        <>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="alerting.routing-tree-picker.default-info">
              Alert instances are routed using the default notification policy tree.
            </Trans>
          </Text>
          <Stack direction="row" gap={1} alignItems="center">
            <Badge
              text={t('alerting.routing-tree-picker.default-badge', 'Default policy')}
              color="blue"
              icon="shield"
            />
            <Button
              variant="secondary"
              fill="text"
              size="sm"
              type="button"
              onClick={() => setIsExpanded(true)}
              aria-label={t('alerting.routing-tree-picker.change-aria', 'Change notification policy')}
            >
              <Trans i18nKey="alerting.routing-tree-picker.change">Change</Trans>
            </Button>
            {viewPoliciesLink}
          </Stack>
        </>
      )}
      {instancesToPreview && instancesToPreview.length > 0 && (
        <RoutingTreePickerPreview routingTree={value} instances={instancesToPreview} />
      )}
    </Stack>
  );
}

interface RoutingTreePickerPreviewProps {
  routingTree: RoutingTree | null;
  instances: Label[][];
}

function RoutingTreePickerPreview({ routingTree, instances }: RoutingTreePickerPreviewProps) {
  // `routingTree` is null when the caller is using the default policy (no explicit selection).
  // We still need the actual default tree object to preview against, so resolve it from the list
  // RoutingTreeSelector already fetches - RTKQ dedupes this against that same cached query.
  const { currentData: routingTrees } = useListRoutingTrees();
  const defaultTree = routingTrees?.items?.find(isDefaultRoutingTree) ?? null;
  const resolvedTree = routingTree ?? defaultTree;

  const match = useMatchInstancesToSpecificRouteTree(resolvedTree, instances);

  if (!resolvedTree) {
    return null;
  }

  const matchedRoutes = match ? Array.from(match.matchedPolicies.keys()) : [];

  if (matchedRoutes.length === 0) {
    return (
      <Alert
        severity="info"
        title={t('alerting.routing-tree-picker.preview-no-match', 'No matching notification policy found')}
      />
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.routing-tree-picker.preview-heading">Who would get notified</Trans>
      </Text>
      {matchedRoutes.map((route) => (
        <Text key={route.id}>
          {route.receiver || t('alerting.routing-tree-picker.preview-default-receiver', 'Default receiver')}
        </Text>
      ))}
    </Stack>
  );
}
