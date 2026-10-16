import { useEffect, useState } from 'react';

import { locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Icon, RadioButtonGroup, Stack, Text, TextLink } from '@grafana/ui';

import { type ContactPoint } from '../../../api/notifications';
import { ContactPointSelector } from '../../../contactPoints/components/ContactPointSelector/ContactPointSelector';
import { useResolvedContactPoint } from '../../../contactPoints/hooks/v1beta1/useResolvedContactPoint';
import { type Label } from '../../../matchers/types';
import { useListTimeIntervals } from '../../../muteTimings/hooks/useListTimeIntervals';
import { RoutingTreePicker } from '../../../notificationPolicies/components/RoutingTreePicker/RoutingTreePicker';
import { useResolvedRoutingTree } from '../../../notificationPolicies/hooks/useResolvedRoutingTree';
import { isDefaultRoutingTreeName } from '../../../notificationPolicies/routingTree.utils';
import { type RoutingTreeView } from '../../../notificationPolicies/routingTreeView';
import {
  type NamedRoutingTreeSettings,
  type NotificationSettings,
  type SimplifiedRoutingSettings,
  namedRoutingTree,
  simplifiedRouting,
} from '../../notificationSettingsValue';
import { isValidRoutingTimings } from '../../utils/promDuration';
import {
  SimplifiedRoutingFields,
  type SimplifiedRoutingFieldsValue,
} from '../SimplifiedRoutingFields/SimplifiedRoutingFields';

export type RecipientMode = 'contactPoint' | 'notificationPolicy';

export interface NotificationsSettingsSelectorProps {
  /** Omit to let the selector own the mode and render a toggle; pass it to control the mode with no toggle. */
  mode?: RecipientMode;
  /** Fires when the toggle switches mode, after the value is reset. Never fires when `mode` is passed. */
  onModeChange?: (mode: RecipientMode) => void;
  /** Treats no contact point as valid. Missing contact points and invalid timings still report invalid. */
  allowEmpty?: boolean;
  /** Makes the whole selector read-only, including the mode toggle. */
  disabled?: boolean;
  /** Hides the muting, grouping and timings section in contact point mode. Values already on the settings are
   * kept and no longer validated. */
  hideRoutingOptions?: boolean;
  value: NotificationSettings | null;
  onChange: (value: NotificationSettings | null) => void;
  /** Fires on mount and when validity changes; `false` when the value can't be saved (no receiver unless `allowEmpty`,
   * a missing receiver,
   * a missing tree, invalid timings, or missing/unusable time intervals). Also false while selected intervals load.
   * Gate saving on it, since timing fields report values as typed. */
  onValidityChange?: (isValid: boolean) => void;
  /** Forwarded to RoutingTreePicker in notificationPolicy mode. See RoutingTreePicker's own docs. */
  instancesToPreview?: Label[][];
  viewPoliciesHref?: string;
  manageContactPointsHref?: string;
}

function modeOf(value: NotificationSettings | null): RecipientMode | undefined {
  if (!value) {
    return undefined;
  }
  return value.type === 'NamedRoutingTree' ? 'notificationPolicy' : 'contactPoint';
}

/** Picks where an alert rule's notifications go — a contact point or named policy tree — with no
 * RuleFormValues/AlertmanagerProvider dependency. */
export function NotificationsSettingsSelector({
  mode: controlledMode,
  onModeChange,
  allowEmpty,
  disabled,
  hideRoutingOptions,
  value,
  onChange,
  onValidityChange,
  instancesToPreview,
  viewPoliciesHref,
  manageContactPointsHref,
}: NotificationsSettingsSelectorProps) {
  // Remember the last value's mode so clearing a named tree keeps the default policy picker open.
  const valueMode = modeOf(value);
  const [ownMode, setOwnMode] = useState<RecipientMode>(valueMode ?? 'contactPoint');
  const mode = controlledMode ?? valueMode ?? ownMode;

  useEffect(() => {
    if (valueMode !== undefined) {
      setOwnMode(valueMode);
    }
  }, [valueMode]);

  const handleModeChange = (next: RecipientMode) => {
    setOwnMode(next);
    onChange(null);
    onModeChange?.(next);
  };

  return (
    <Stack direction="column" gap={1}>
      {controlledMode === undefined && (
        <RadioButtonGroup
          value={mode}
          onChange={handleModeChange}
          disabled={disabled}
          options={[
            {
              value: 'contactPoint',
              label: t('alerting.notifications-settings-selector.mode-contact-point', 'Contact point'),
            },
            {
              value: 'notificationPolicy',
              label: t('alerting.notifications-settings-selector.mode-notification-policy', 'Notification policy'),
            },
          ]}
        />
      )}
      {mode === 'contactPoint' ? (
        <ContactPointRecipient
          value={value?.type === 'SimplifiedRouting' ? value : null}
          onChange={onChange}
          onValidityChange={onValidityChange}
          allowEmpty={allowEmpty}
          disabled={disabled}
          hideRoutingOptions={hideRoutingOptions}
          manageContactPointsHref={manageContactPointsHref}
        />
      ) : (
        <NotificationPolicyRecipient
          value={value?.type === 'NamedRoutingTree' ? value : null}
          onChange={onChange}
          onValidityChange={onValidityChange}
          disabled={disabled}
          instancesToPreview={instancesToPreview}
          viewPoliciesHref={viewPoliciesHref}
        />
      )}
    </Stack>
  );
}

interface ContactPointRecipientProps {
  value: SimplifiedRoutingSettings | null;
  onChange: (value: NotificationSettings | null) => void;
  onValidityChange?: (isValid: boolean) => void;
  allowEmpty?: boolean;
  disabled?: boolean;
  hideRoutingOptions?: boolean;
  manageContactPointsHref?: string;
}

function ContactPointRecipient({
  value,
  onChange,
  onValidityChange,
  allowEmpty,
  disabled,
  hideRoutingOptions,
  manageContactPointsHref,
}: ContactPointRecipientProps) {
  const { status, selectorValue } = useResolvedContactPoint(value?.receiver);
  // The saved receiver isn't in the picker's options, so the user has to pick another one.
  const isReceiverUnavailable = status === 'notFound' || status === 'unusable';
  const { timeIntervals, isLoading: isLoadingTimeIntervals, isError: isTimeIntervalsError } = useListTimeIntervals();
  const selectedTimeIntervals = [
    ...new Set([...(value?.muteTimeIntervals ?? []), ...(value?.activeTimeIntervals ?? [])]),
  ];
  const unavailableTimeIntervals =
    isLoadingTimeIntervals || isTimeIntervalsError
      ? []
      : selectedTimeIntervals.filter(
          (name) => !timeIntervals.some((interval) => interval.name === name && interval.canUse)
        );
  const hasValidTimeIntervals =
    selectedTimeIntervals.length === 0 ||
    (!isLoadingTimeIntervals && !isTimeIntervalsError && unavailableTimeIntervals.length === 0);
  const isValid =
    (allowEmpty || Boolean(value?.receiver)) &&
    !isReceiverUnavailable &&
    (hideRoutingOptions || (isValidRoutingTimings(value ?? {}) && hasValidTimeIntervals));

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  // Simplified-routing rules inherit unset timings from the default policy tree.
  const { tree: defaultTree } = useResolvedRoutingTree();
  const timingsValue: SimplifiedRoutingFieldsValue = {
    groupBy: value?.groupBy,
    groupWait: value?.groupWait,
    groupInterval: value?.groupInterval,
    repeatInterval: value?.repeatInterval,
    muteTimeIntervals: value?.muteTimeIntervals,
    activeTimeIntervals: value?.activeTimeIntervals,
  };

  // Combobox's clear icon ignores `disabled`, so clearing is switched off instead.
  const clearable: { isClearable: true } | { isClearable?: false } = disabled ? {} : { isClearable: true };

  const handleContactPointChange = (contactPoint: ContactPoint | null) => {
    if (!contactPoint) {
      onChange(null);
      return;
    }
    onChange(simplifiedRouting(contactPoint.spec.title, timingsValue));
  };

  const handleTimingsChange = (timings: SimplifiedRoutingFieldsValue) => {
    if (!value?.receiver) {
      // receiver is required — there's no valid object to emit without one. SimplifiedRoutingFields
      // gets `disabledReason` below so the fields are visibly inert instead of silently discarding input.
      return;
    }
    onChange(simplifiedRouting(value.receiver, timings));
  };

  // A failed fetch would otherwise resolve to null and show "no contact point selected" for a rule that has one.
  if (status === 'error') {
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
      {status === 'notFound' && (
        <Alert
          severity="warning"
          title={t(
            'alerting.notifications-settings-selector.contact-point-not-found',
            'The previously selected contact point could not be found — it may have been deleted'
          )}
        />
      )}
      {status === 'unusable' && (
        <Alert
          severity="warning"
          title={t(
            'alerting.notifications-settings-selector.contact-point-unusable',
            'The previously selected contact point cannot be used — it may have been imported from an external Alertmanager'
          )}
        />
      )}
      {!hideRoutingOptions && unavailableTimeIntervals.length > 0 && (
        <Alert
          severity="warning"
          title={t(
            'alerting.notifications-settings-selector.time-intervals-unavailable',
            'Some selected mute or active time intervals no longer exist or cannot be used: {{names}}',
            { names: unavailableTimeIntervals.join(', ') }
          )}
        />
      )}
      <Stack direction="row" alignItems="center" gap={1}>
        <ContactPointSelector
          value={selectorValue}
          onChange={handleContactPointChange}
          {...clearable}
          disabled={disabled}
          aria-label={t('alerting.notifications-settings-selector.contact-point-aria', 'Contact point')}
        />
        {manageContactPointsHref && (
          <TextLink href={locationUtil.assureBaseUrl(manageContactPointsHref)} external>
            <Trans i18nKey="alerting.notifications-settings-selector.manage-contact-points">
              View or create contact points
            </Trans>
          </TextLink>
        )}
      </Stack>
      {!hideRoutingOptions && (
        <SimplifiedRoutingFields
          value={timingsValue}
          onChange={handleTimingsChange}
          inheritedTimings={defaultTree?.defaults}
          disabled={disabled}
          disabledReason={
            value?.receiver && !isReceiverUnavailable
              ? undefined
              : t('alerting.notifications-settings-selector.timings-disabled', 'Select a contact point first')
          }
        />
      )}
    </Stack>
  );
}

interface NotificationPolicyRecipientProps {
  value: NamedRoutingTreeSettings | null;
  onChange: (value: NotificationSettings | null) => void;
  onValidityChange?: (isValid: boolean) => void;
  disabled?: boolean;
  instancesToPreview?: Label[][];
  viewPoliciesHref?: string;
}

function NotificationPolicyRecipient({
  value,
  onChange,
  onValidityChange,
  disabled,
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

  const handleChange = (tree: RoutingTreeView | null) => {
    if (!tree || tree.isDefault) {
      onChange(null);
      return;
    }
    onChange(namedRoutingTree(tree.name));
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
        >
          {/* The picker already shows "Default policy" here, so re-picking it emits nothing. */}
          <Button size="sm" variant="secondary" onClick={() => onChange(null)} disabled={disabled}>
            <Trans i18nKey="alerting.notifications-settings-selector.routing-tree-reset">Use the default policy</Trans>
          </Button>
        </Alert>
      )}
      <RoutingTreePicker
        value={selectedTree}
        onChange={handleChange}
        disabled={disabled}
        instancesToPreview={isNotFound ? undefined : instancesToPreview}
        viewPoliciesHref={viewPoliciesHref}
      />
    </Stack>
  );
}
