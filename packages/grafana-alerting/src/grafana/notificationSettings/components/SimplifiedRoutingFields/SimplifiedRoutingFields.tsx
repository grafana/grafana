import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type AlertRuleSimplifiedRouting } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, CollapsableSection, Field, Stack, Text, useStyles2 } from '@grafana/ui';

import { useListTimeIntervals } from '../../../muteTimings/hooks/useListTimeIntervals';
import { type RoutingTimings } from '../../constants';
import { GroupingOverride } from '../GroupingOverride/GroupingOverride';
import { TimeIntervalsSelect } from '../TimeIntervalsSelect/TimeIntervalsSelect';
import { TimingsOverride } from '../TimingsOverride/TimingsOverride';

export type SimplifiedRoutingFieldsValue = Omit<AlertRuleSimplifiedRouting, 'receiver' | 'type'>;

export interface SimplifiedRoutingFieldsProps {
  value: SimplifiedRoutingFieldsValue;
  onChange: (value: SimplifiedRoutingFieldsValue) => void;
  /** What the rule inherits for unset timings. See `TimingsOverride`'s `defaults`. */
  inheritedTimings?: RoutingTimings;
  /** When set, the section stays expandable but every field is disabled and shows this as the
   * reason (e.g. "Select a contact point first"). `undefined` means enabled. */
  disabledReason?: string;
}

/** The "Muting, grouping and timings (optional)" section. Excludes `receiver`, which
 * NotificationsSettingsSelector owns. */
export function SimplifiedRoutingFields({
  value,
  onChange,
  inheritedTimings,
  disabledReason,
}: SimplifiedRoutingFieldsProps) {
  const styles = useStyles2(getStyles);
  const { isError, currentData } = useListTimeIntervals();
  // A refetch that fails keeps the last good list, which the selects still offer.
  const isTimeIntervalsError = isError && !currentData;
  const disabled = Boolean(disabledReason);

  const hasRouteSettings = Boolean(
    value.groupBy?.length ||
      value.groupWait ||
      value.groupInterval ||
      value.repeatInterval ||
      value.muteTimeIntervals?.length ||
      value.activeTimeIntervals?.length
  );

  // Opens when `value` arrives with settings (e.g. a rule loaded after mount), but only the user closes it:
  // closing on cleared values would unmount the override switches mid-edit.
  const [isSectionOpen, setIsSectionOpen] = useState(hasRouteSettings);
  useEffect(() => {
    if (hasRouteSettings) {
      setIsSectionOpen(true);
    }
  }, [hasRouteSettings]);

  return (
    <div className={styles.routingSection}>
      <CollapsableSection
        label={t('alerting.simplified-routing-fields.toggle', 'Muting, grouping and timings (optional)')}
        isOpen={isSectionOpen}
        onToggle={setIsSectionOpen}
        className={styles.collapsableSection}
        contentClassName={styles.collapsableSectionContent}
      >
        <Stack direction="column" gap={1}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.simplified-routing-fields.description">
              Configure how notifications for this alert rule are sent.
            </Trans>
          </Text>
          {disabledReason && (
            <Text variant="bodySmall" color="secondary">
              {disabledReason}
            </Text>
          )}
          {isTimeIntervalsError && (
            <Alert
              severity="warning"
              title={t(
                'alerting.simplified-routing-fields.time-intervals-error',
                'Could not load mute/active timings — showing the rest of the section without them.'
              )}
            />
          )}
          <Field
            label={t('alerting.simplified-routing-fields.mute-timings', 'Mute timings')}
            description={t(
              'alerting.simplified-routing-fields.mute-timings-description',
              'Select a mute timing to define when not to send notifications for this alert rule'
            )}
            disabled={disabled}
            noMargin
          >
            <TimeIntervalsSelect
              aria-label={t('alerting.simplified-routing-fields.mute-timings', 'Mute timings')}
              value={value.muteTimeIntervals ?? []}
              onChange={(muteTimeIntervals) => onChange({ ...value, muteTimeIntervals })}
            />
          </Field>
          <Field
            label={t('alerting.simplified-routing-fields.active-timings', 'Active timings')}
            description={t(
              'alerting.simplified-routing-fields.active-timings-description',
              'Select a time interval to define when to only send notifications for this alert rule'
            )}
            disabled={disabled}
            noMargin
          >
            <TimeIntervalsSelect
              aria-label={t('alerting.simplified-routing-fields.active-timings', 'Active timings')}
              value={value.activeTimeIntervals ?? []}
              onChange={(activeTimeIntervals) => onChange({ ...value, activeTimeIntervals })}
            />
          </Field>
          <GroupingOverride
            value={value.groupBy}
            onChange={(groupBy) => onChange({ ...value, groupBy })}
            disabled={disabled}
          />
          <TimingsOverride
            value={value}
            defaults={inheritedTimings}
            onChange={(timings) => onChange({ ...value, ...timings })}
            disabled={disabled}
          />
        </Stack>
      </CollapsableSection>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  routingSection: css({
    display: 'flex',
    flexDirection: 'column',
    maxWidth: theme.breakpoints.values.xl,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
  }),
  // CollapsableSection's header defaults to a large font size.
  collapsableSection: css({
    width: 'fit-content',
    fontSize: theme.typography.body.fontSize,
  }),
  // routingSection already pads the box.
  collapsableSectionContent: css({
    padding: 0,
  }),
});
