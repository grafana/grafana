import { useEffect, useState } from 'react';

import { locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Button, Stack, Text, TextLink } from '@grafana/ui';

import { type RoutingTree } from '../../../api/notifications';
import { type Label } from '../../../matchers/types';
import { USER_DEFINED_TREE_NAME } from '../../routingTree.utils';
import { type RoutingTreeView, toRoutingTreeView } from '../../routingTreeView';
import { RoutingTreePreview } from '../RoutingTreePreview/RoutingTreePreview';
import { RoutingTreeSelector } from '../RoutingTreeSelector/RoutingTreeSelector';

export interface RoutingTreePickerProps {
  /** `null` means "use the default policy" - no explicit tree chosen. */
  value: RoutingTreeView | null;
  onChange: (value: RoutingTreeView | null) => void;
  /** Alert instance label sets to preview which policy route would receive the notification,
   * whether `value` is explicit or `null` (default policy). Omit to skip the preview. */
  instancesToPreview?: Label[][];
  /** Link target for "View policies". Omit to hide the link. */
  viewPoliciesHref?: string;
  /** Disables changing the policy. Collapse and the "View policies" link stay usable. */
  disabled?: boolean;
}

function isUsingDefaultPolicy(value: RoutingTreeView | null): boolean {
  return value === null || value.isDefault;
}

/** Lets a caller pick which notification policy tree routes an alert rule, with no alert-rule-form dependency. */
export function RoutingTreePicker({
  value,
  onChange,
  instancesToPreview,
  viewPoliciesHref,
  disabled,
}: RoutingTreePickerProps) {
  const usingDefault = isUsingDefaultPolicy(value);
  const [isExpanded, setIsExpanded] = useState(!usingDefault);

  useEffect(() => {
    setIsExpanded(!usingDefault);
  }, [usingDefault]);

  // Collapsing is left to the effect above so the picker only claims the default once the parent accepts it.
  const handleResetToDefault = () => onChange(null);

  // RoutingTreeSelector always returns the concrete tree object, even the default-named one — normalize
  // to null so the dropdown and Reset button agree on one "default" representation.
  const handleRoutingTreeSelectorChange = (tree: RoutingTree) => {
    const view = toRoutingTreeView(tree);
    onChange(view.isDefault ? null : view);
  };

  const viewPoliciesLink = viewPoliciesHref && (
    <TextLink
      href={locationUtil.assureBaseUrl(viewPoliciesHref)}
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
              value={value ? value.name : USER_DEFINED_TREE_NAME}
              onChange={handleRoutingTreeSelectorChange}
              disabled={disabled}
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
                disabled={disabled}
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
              disabled={disabled}
              aria-label={t('alerting.routing-tree-picker.change-aria', 'Change notification policy')}
            >
              <Trans i18nKey="alerting.routing-tree-picker.change">Change</Trans>
            </Button>
            {viewPoliciesLink}
          </Stack>
        </>
      )}
      {instancesToPreview && instancesToPreview.length > 0 && (
        <RoutingTreePreview routingTreeName={value?.name} instances={instancesToPreview} />
      )}
    </Stack>
  );
}
