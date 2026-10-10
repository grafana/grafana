import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type AlertRuleSimplifiedRouting } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, CollapsableSection, Field, Stack, Text, useStyles2 } from '@grafana/ui';

import { useListTimeIntervals } from '../../../muteTimings/hooks/useListTimeIntervals';
import { GroupingOverride } from '../GroupingOverride/GroupingOverride';
import { TimeIntervalsSelect } from '../TimeIntervalsSelect/TimeIntervalsSelect';
import { TimingsOverride } from '../TimingsOverride/TimingsOverride';

export type SimplifiedRoutingFieldsValue = Omit<AlertRuleSimplifiedRouting, 'receiver' | 'type'>;

export interface SimplifiedRoutingFieldsProps {
  value: SimplifiedRoutingFieldsValue;
  onChange: (value: SimplifiedRoutingFieldsValue) => void;
  /** When set, the section stays expandable but every field is disabled and shows this as the
   * reason (e.g. "Select a contact point first"). `undefined` means enabled. */
  disabledReason?: string;
}

/** The "Muting, grouping and timings (optional)" section, matching AlertManagerManualRouting.tsx /
 * RouteSettings.tsx. Excludes `receiver` — NotificationsSettingsSelector owns that shared field. */
export function SimplifiedRoutingFields({ value, onChange, disabledReason }: SimplifiedRoutingFieldsProps) {
  const styles = useStyles2(getStyles);
  const { isError: isTimeIntervalsError } = useListTimeIntervals();
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
            onChange={(timings) => onChange({ ...value, ...timings })}
            disabled={disabled}
          />
        </Stack>
      </CollapsableSection>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Matches the internal AlertManagerManualRouting.tsx's routingSection style — the bordered box
  // the whole collapsible section sits inside.
  routingSection: css({
    display: 'flex',
    flexDirection: 'column',
    maxWidth: theme.breakpoints.values.xl,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
  }),
  // CollapsableSection's own header defaults to theme.typography.size.lg — override it back down
  // to body size, matching the internal component's collapsableSection style.
  collapsableSection: css({
    width: 'fit-content',
    fontSize: theme.typography.body.fontSize,
  }),
  // CollapsableSection's content has its own vertical padding by default; the routingSection div
  // above already pads the whole box, so zero this out to avoid doubling up.
  collapsableSectionContent: css({
    padding: 0,
  }),
});
