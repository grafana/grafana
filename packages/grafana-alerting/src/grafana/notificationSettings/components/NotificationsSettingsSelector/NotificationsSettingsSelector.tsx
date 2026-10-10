import { useEffect } from 'react';

import {
  type AlertRuleNamedRoutingTree,
  type AlertRuleNotificationSettings,
  type AlertRuleSimplifiedRouting,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Trans, t } from '@grafana/i18n';
import { Alert, Icon, Stack, Text, TextLink } from '@grafana/ui';

import { type ContactPoint, type RoutingTree } from '../../../api/notifications';
import { ContactPointSelector } from '../../../contactPoints/components/ContactPointSelector/ContactPointSelector';
import { useResolvedContactPoint } from '../../../contactPoints/hooks/v1beta1/useResolvedContactPoint';
import { type Label } from '../../../matchers/types';
import { RoutingTreePicker } from '../../../notificationPolicies/components/RoutingTreePicker/RoutingTreePicker';
import { useResolvedRoutingTree } from '../../../notificationPolicies/hooks/useResolvedRoutingTree';
import { isDefaultRoutingTree, isDefaultRoutingTreeName } from '../../../notificationPolicies/routingTree.utils';
import { isValidRoutingTimings } from '../../utils/promDuration';
import {
  asNamedRoutingTree,
  asSimplifiedRouting,
  toNamedRoutingTree,
  toSimplifiedRouting,
} from '../../utils/routingValue';
import {
  SimplifiedRoutingFields,
  type SimplifiedRoutingFieldsValue,
} from '../SimplifiedRoutingFields/SimplifiedRoutingFields';

export type RecipientMode = 'contactPoint' | 'notificationPolicy';

export interface NotificationsSettingsSelectorProps {
  mode: RecipientMode;
  value: AlertRuleNotificationSettings | null;
  onChange: (value: AlertRuleNotificationSettings | null) => void;
  /** Fires on mount and whenever computed validity changes. `false` when the value can't be saved: in
   * `contactPoint` mode, no receiver, a receiver that no longer exists, or an invalid timing (see
   * `isValidRoutingTimings`); in `notificationPolicy` mode, a named tree that no longer exists. Gate saving on it,
   * since the timing fields report invalid values as typed. */
  onValidityChange?: (isValid: boolean) => void;
  /** Forwarded to RoutingTreePicker in notificationPolicy mode. See RoutingTreePicker's own docs. */
  instancesToPreview?: Label[][];
  viewPoliciesHref?: string;
  manageContactPointsHref?: string;
}

/** Picks where an alert rule's notifications go — a contact point or named policy tree — with no
 * RuleFormValues/AlertmanagerProvider dependency. `mode` is caller-controlled; no toggle rendered. */
export function NotificationsSettingsSelector({
  mode,
  value,
  onChange,
  onValidityChange,
  instancesToPreview,
  viewPoliciesHref,
  manageContactPointsHref,
}: NotificationsSettingsSelectorProps) {
  return (
    <Stack direction="column" gap={1}>
      {mode === 'contactPoint' ? (
        <ContactPointRecipient
          value={asSimplifiedRouting(value)}
          onChange={onChange}
          onValidityChange={onValidityChange}
          manageContactPointsHref={manageContactPointsHref}
        />
      ) : (
        <NotificationPolicyRecipient
          value={asNamedRoutingTree(value)}
          onChange={onChange}
          onValidityChange={onValidityChange}
          instancesToPreview={instancesToPreview}
          viewPoliciesHref={viewPoliciesHref}
        />
      )}
    </Stack>
  );
}

interface ContactPointRecipientProps {
  value: AlertRuleSimplifiedRouting | null;
  onChange: (value: AlertRuleNotificationSettings | null) => void;
  onValidityChange?: (isValid: boolean) => void;
  manageContactPointsHref?: string;
}

function ContactPointRecipient({
  value,
  onChange,
  onValidityChange,
  manageContactPointsHref,
}: ContactPointRecipientProps) {
  const { selectorValue, isNotFound, isError } = useResolvedContactPoint(value?.receiver);
  const isValid = Boolean(value?.receiver) && !isNotFound && isValidRoutingTimings(value ?? {});

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  // Simplified-routing rules inherit unset timings from the default policy tree.
  const { tree: defaultTree } = useResolvedRoutingTree();
  const inheritedTimings = {
    groupWait: defaultTree?.spec.defaults.group_wait,
    groupInterval: defaultTree?.spec.defaults.group_interval,
    repeatInterval: defaultTree?.spec.defaults.repeat_interval,
  };

  const timingsValue: SimplifiedRoutingFieldsValue = {
    groupBy: value?.groupBy,
    groupWait: value?.groupWait,
    groupInterval: value?.groupInterval,
    repeatInterval: value?.repeatInterval,
    muteTimeIntervals: value?.muteTimeIntervals,
    activeTimeIntervals: value?.activeTimeIntervals,
  };

  const handleContactPointChange = (contactPoint: ContactPoint | null) => {
    if (!contactPoint) {
      onChange(null);
      return;
    }
    onChange(toSimplifiedRouting(contactPoint.spec.title, timingsValue));
  };

  const handleTimingsChange = (timings: SimplifiedRoutingFieldsValue) => {
    if (!value?.receiver) {
      // receiver is required — there's no valid object to emit without one. SimplifiedRoutingFields
      // gets `disabledReason` below so the fields are visibly inert instead of silently discarding input.
      return;
    }
    onChange(toSimplifiedRouting(value.receiver, timings));
  };

  // A failed fetch would otherwise resolve to null and show "no contact point selected" for a rule that has one.
  if (isError) {
    return (
      <Alert
        severity="error"
        title={t('alerting.notifications-settings-selector.contact-points-error', 'Could not load contact points')}
      />
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.notifications-settings-selector.contact-point-description">
          Notifications for firing alerts are routed to a selected contact point.
        </Trans>
      </Text>
      <Stack direction="row" alignItems="center" gap={1}>
        <Icon name="grafana" />
        <Text>{t('alerting.notifications-settings-selector.alertmanager-label', 'Alertmanager: grafana')}</Text>
      </Stack>
      {isNotFound && (
        <Alert
          severity="warning"
          title={t(
            'alerting.notifications-settings-selector.contact-point-not-found',
            'The previously selected contact point could not be found — it may have been deleted'
          )}
        />
      )}
      <Stack direction="row" alignItems="center" gap={1}>
        <ContactPointSelector
          value={selectorValue}
          onChange={handleContactPointChange}
          isClearable
          aria-label={t('alerting.notifications-settings-selector.contact-point-aria', 'Contact point')}
        />
        {manageContactPointsHref && (
          <TextLink href={manageContactPointsHref} external>
            <Trans i18nKey="alerting.notifications-settings-selector.manage-contact-points">
              View or create contact points
            </Trans>
          </TextLink>
        )}
      </Stack>
      <SimplifiedRoutingFields
        value={timingsValue}
        onChange={handleTimingsChange}
        inheritedTimings={inheritedTimings}
        disabledReason={
          value?.receiver && !isNotFound
            ? undefined
            : t('alerting.notifications-settings-selector.timings-disabled', 'Select a contact point first')
        }
      />
    </Stack>
  );
}

interface NotificationPolicyRecipientProps {
  value: AlertRuleNamedRoutingTree | null;
  onChange: (value: AlertRuleNotificationSettings | null) => void;
  onValidityChange?: (isValid: boolean) => void;
  instancesToPreview?: Label[][];
  viewPoliciesHref?: string;
}

function NotificationPolicyRecipient({
  value,
  onChange,
  onValidityChange,
  instancesToPreview,
  viewPoliciesHref,
}: NotificationPolicyRecipientProps) {
  // A tree we couldn't confirm yet or couldn't find must not silently show as "Default policy" while the
  // caller's actual value is untouched, so resolving and not-found are told apart from the default.
  const {
    tree: selectedTree,
    isResolving,
    isNotFound: isTreeNotFound,
    isError,
  } = useResolvedRoutingTree(value?.routingTree);
  // Default routing is not a reference to a tree, so an unreadable or empty list doesn't make it missing.
  const isNotFound = isTreeNotFound && !isDefaultRoutingTreeName(value?.routingTree);

  // A saved tree that no longer exists is rejected by the backend; `null` (default policy) is always valid.
  useEffect(() => {
    onValidityChange?.(!isNotFound);
  }, [isNotFound, onValidityChange]);

  const handleChange = (tree: RoutingTree | null) => {
    if (!tree || !tree.metadata.name || isDefaultRoutingTree(tree)) {
      onChange(null);
      return;
    }
    onChange(toNamedRoutingTree(tree.metadata.name));
  };

  if (isError) {
    return (
      <Alert
        severity="error"
        title={t(
          'alerting.notifications-settings-selector.routing-trees-error',
          'Could not load notification policies'
        )}
      />
    );
  }

  if (isResolving) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      {isNotFound && (
        <Alert
          severity="warning"
          title={t(
            'alerting.notifications-settings-selector.routing-tree-not-found',
            'The previously selected notification policy could not be found — it may have been deleted'
          )}
        />
      )}
      <RoutingTreePicker
        value={selectedTree}
        onChange={handleChange}
        instancesToPreview={isNotFound ? undefined : instancesToPreview}
        viewPoliciesHref={viewPoliciesHref}
      />
    </Stack>
  );
}
