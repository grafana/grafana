import { useEffect } from 'react';

import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import {
  type AlertRuleNamedRoutingTree,
  type AlertRuleNotificationSettings,
  type AlertRuleSimplifiedRouting,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Trans, t } from '@grafana/i18n';
import { Alert, Icon, Stack, Text, TextLink } from '@grafana/ui';

import { type ContactPoint } from '../../../api/notifications/v1beta1/types';
import { ContactPointSelector } from '../../../contactPoints/components/ContactPointSelector/ContactPointSelector';
import { useResolvedContactPoint } from '../../../contactPoints/hooks/v1beta1/useResolvedContactPoint';
import { type Label } from '../../../matchers/types';
import { RoutingTreePicker } from '../../../notificationPolicies/components/RoutingTreePicker/RoutingTreePicker';
import { useResolvedRoutingTree } from '../../../notificationPolicies/hooks/useResolvedRoutingTree';
import { isDefaultRoutingTree } from '../../../notificationPolicies/routingTrees';
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
  /** Fires on mount and whenever computed validity changes. Only ever `false` in `contactPoint` mode
   * with no receiver selected — `notificationPolicy` mode has no required field. */
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
  const isValid = mode === 'notificationPolicy' || Boolean(asSimplifiedRouting(value)?.receiver);

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  return (
    <Stack direction="column" gap={1}>
      {mode === 'contactPoint' ? (
        <ContactPointRecipient
          value={asSimplifiedRouting(value)}
          onChange={onChange}
          manageContactPointsHref={manageContactPointsHref}
        />
      ) : (
        <NotificationPolicyRecipient
          value={asNamedRoutingTree(value)}
          onChange={onChange}
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
  manageContactPointsHref?: string;
}

function ContactPointRecipient({ value, onChange, manageContactPointsHref }: ContactPointRecipientProps) {
  const { selectorValue, isError } = useResolvedContactPoint(value?.receiver);

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

  // Mirrors RoutingTreePolicyField's isError guard: a failed fetch would otherwise resolve to null,
  // silently showing "no contact point selected" for a rule that actually has one.
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
        disabledReason={
          value?.receiver
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
  instancesToPreview?: Label[][];
  viewPoliciesHref?: string;
}

function NotificationPolicyRecipient({
  value,
  onChange,
  instancesToPreview,
  viewPoliciesHref,
}: NotificationPolicyRecipientProps) {
  // A tree we couldn't confirm yet or couldn't find must not silently show as "Default policy" while the
  // caller's actual value is untouched, so resolving and not-found are told apart from the default.
  const { tree: selectedTree, isResolving, isNotFound, isError } = useResolvedRoutingTree(value?.routingTree);

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
