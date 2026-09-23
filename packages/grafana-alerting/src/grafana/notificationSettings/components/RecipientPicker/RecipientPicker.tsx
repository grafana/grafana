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
import { useListContactPoints } from '../../../contactPoints/hooks/v1beta1/useContactPoints';
import { type Label } from '../../../matchers/types';
import { RoutingTreePicker } from '../../../notificationPolicies/components/RoutingTreePicker/RoutingTreePicker';
import { useListRoutingTrees } from '../../../notificationPolicies/hooks/useRoutingTrees';
import { isDefaultRoutingTree } from '../../../notificationPolicies/routingTrees';
import {
  SimplifiedRoutingFields,
  type SimplifiedRoutingFieldsValue,
} from '../SimplifiedRoutingFields/SimplifiedRoutingFields';

export type RecipientMode = 'contactPoint' | 'notificationPolicy';

export interface RecipientPickerProps {
  mode: RecipientMode;
  value: AlertRuleNotificationSettings | null;
  onChange: (value: AlertRuleNotificationSettings | null) => void;
  /** Forwarded to RoutingTreePicker in notificationPolicy mode. See RoutingTreePicker's own docs. */
  instancesToPreview?: Label[][];
  viewPoliciesHref?: string;
  manageContactPointsHref?: string;
}

// `type` isn't a true discriminant here — both branches share the same AlertRuleNotificationSettingsType
// union — so narrow on `receiver`/`routingTree` instead, each unique to one branch. Exported so
// consumers don't have to rediscover and reimplement this narrowing themselves.
export function asSimplifiedRouting(value: AlertRuleNotificationSettings | null): AlertRuleSimplifiedRouting | null {
  if (value !== null && 'receiver' in value) {
    return value;
  }
  return null;
}

export function asNamedRoutingTree(value: AlertRuleNotificationSettings | null): AlertRuleNamedRoutingTree | null {
  if (value !== null && 'routingTree' in value) {
    return value;
  }
  return null;
}

/** Picks where an alert rule's notifications go — a contact point or named policy tree — with no
 * RuleFormValues/AlertmanagerProvider dependency. `mode` is caller-controlled; no toggle rendered. */
export function RecipientPicker({
  mode,
  value,
  onChange,
  instancesToPreview,
  viewPoliciesHref,
  manageContactPointsHref,
}: RecipientPickerProps) {
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
  const { currentData: contactPoints, isError } = useListContactPoints();

  // receiver is the contact point's *title*, but ContactPointSelector's option value is uid-or-title —
  // resolve by title match so a titled receiver still shows selected even when the contact point has a uid.
  const selectedContactPoint = contactPoints?.items?.find((cp) => cp.spec.title === value?.receiver);
  const comboboxValue = selectedContactPoint
    ? (selectedContactPoint.metadata.uid ?? selectedContactPoint.spec.title)
    : null;

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
    onChange({ type: 'SimplifiedRouting', receiver: contactPoint.spec.title, ...timingsValue });
  };

  const handleTimingsChange = (timings: SimplifiedRoutingFieldsValue) => {
    if (!value?.receiver) {
      // receiver is required — there's no valid object to emit without one. SimplifiedRoutingFields
      // gets `disabledReason` below so the fields are visibly inert instead of silently discarding input.
      return;
    }
    onChange({ type: 'SimplifiedRouting', receiver: value.receiver, ...timings });
  };

  // Mirrors RoutingTreePolicyField's isError guard: a failed fetch would otherwise resolve to null,
  // silently showing "no contact point selected" for a rule that actually has one.
  if (isError) {
    return (
      <Alert
        severity="error"
        title={t('alerting.recipient-picker.contact-points-error', 'Could not load contact points')}
      />
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.recipient-picker.contact-point-description">
          Notifications for firing alerts are routed to a selected contact point.
        </Trans>
      </Text>
      <Stack direction="row" alignItems="center" gap={1}>
        <Icon name="grafana" />
        <Text>{t('alerting.recipient-picker.alertmanager-label', 'Alertmanager: grafana')}</Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={1}>
        <ContactPointSelector
          value={comboboxValue}
          onChange={handleContactPointChange}
          isClearable
          aria-label={t('alerting.recipient-picker.contact-point-aria', 'Contact point')}
        />
        {manageContactPointsHref && (
          <TextLink href={manageContactPointsHref} external>
            <Trans i18nKey="alerting.recipient-picker.manage-contact-points">View or create contact points</Trans>
          </TextLink>
        )}
      </Stack>
      <SimplifiedRoutingFields
        value={timingsValue}
        onChange={handleTimingsChange}
        disabledReason={
          value?.receiver ? undefined : t('alerting.recipient-picker.timings-disabled', 'Select a contact point first')
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
  const { currentData: routingTrees, isError } = useListRoutingTrees();

  // Same reasoning as ContactPointRecipient's isError guard: falling back to null here would show
  // "Default policy" for a rule that actually has a named tree we just couldn't confirm yet.
  const isResolvingTree = Boolean(value?.routingTree) && !routingTrees?.items;

  const selectedTree = value?.routingTree
    ? (routingTrees?.items?.find((tree) => tree.metadata.name === value.routingTree) ?? null)
    : null;

  const handleChange = (tree: RoutingTree | null) => {
    if (!tree || !tree.metadata.name || isDefaultRoutingTree(tree)) {
      onChange(null);
      return;
    }
    onChange({ type: 'NamedRoutingTree', routingTree: tree.metadata.name });
  };

  if (isError) {
    return (
      <Alert
        severity="error"
        title={t('alerting.recipient-picker.routing-trees-error', 'Could not load notification policies')}
      />
    );
  }

  if (isResolvingTree) {
    return null;
  }

  return (
    <RoutingTreePicker
      value={selectedTree}
      onChange={handleChange}
      instancesToPreview={instancesToPreview}
      viewPoliciesHref={viewPoliciesHref}
    />
  );
}
