import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type AlertRuleSimplifiedRouting } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  CollapsableSection,
  Field,
  InlineField,
  MultiSelect,
  Stack,
  Switch,
  Text,
  useStyles2,
} from '@grafana/ui';

import { useListTimeIntervals } from '../../../muteTimings/hooks/useListTimeIntervals';
import { DurationField } from '../DurationField/DurationField';
import { GroupByField } from '../GroupByField/GroupByField';

const TIMING_DEFAULTS = { groupWait: '30s', groupInterval: '5m', repeatInterval: '4h' };
// Mirrors the internal RouteSettings.tsx's REQUIRED_FIELDS_IN_GROUPBY: what "Grouping: ..." shows
// when the user hasn't overridden it, and what a fresh override starts from.
const REQUIRED_GROUP_BY_LABELS = ['grafana_folder', 'alertname'];

export type SimplifiedRoutingFieldsValue = Omit<AlertRuleSimplifiedRouting, 'receiver' | 'type'>;

export interface SimplifiedRoutingFieldsProps {
  value: SimplifiedRoutingFieldsValue;
  onChange: (value: SimplifiedRoutingFieldsValue) => void;
  /** When set, the section stays expandable but every field is disabled and shows this as the
   * reason (e.g. "Select a contact point first"). `undefined` means enabled. */
  disabledReason?: string;
}

/** The "Muting, grouping and timings (optional)" section, matching AlertManagerManualRouting.tsx /
 * RouteSettings.tsx. Excludes `receiver` — RecipientPicker owns that shared field. */
export function SimplifiedRoutingFields({ value, onChange, disabledReason }: SimplifiedRoutingFieldsProps) {
  const styles = useStyles2(getStyles);
  const { currentData: timeIntervals, isError: isTimeIntervalsError } = useListTimeIntervals();
  const disabled = Boolean(disabledReason);

  const [overrideGrouping, setOverrideGrouping] = useState(() => Boolean(value.groupBy?.length));
  const [overrideTimings, setOverrideTimings] = useState(() =>
    Boolean(value.groupWait || value.groupInterval || value.repeatInterval)
  );
  const hasRouteSettings =
    overrideGrouping ||
    overrideTimings ||
    Boolean(value.muteTimeIntervals?.length) ||
    Boolean(value.activeTimeIntervals?.length);

  // Mirrors RouteSettings.tsx's own effect: seed the required labels on opt-in, rather than
  // starting empty (which would mean "group by nothing", not "the defaults plus whatever you add").
  useEffect(() => {
    if (overrideGrouping && !value.groupBy?.length) {
      onChange({ ...value, groupBy: REQUIRED_GROUP_BY_LABELS });
    }
    // Runs only on the switch flip, not on every keystroke in the field it seeds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideGrouping]);

  const timeIntervalOptions = (timeIntervals?.items ?? [])
    .filter((ti): ti is typeof ti & { metadata: { name: string } } => Boolean(ti.metadata.name))
    .map((ti) => ({ label: ti.metadata.name, value: ti.metadata.name }));

  return (
    <div className={styles.routingSection}>
      <CollapsableSection
        label={t('alerting.simplified-routing-fields.toggle', 'Muting, grouping and timings (optional)')}
        isOpen={hasRouteSettings}
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
            <MultiSelect
              aria-label={t('alerting.simplified-routing-fields.mute-timings', 'Mute timings')}
              placeholder={t('alerting.simplified-routing-fields.select-time-intervals', 'Select time intervals...')}
              options={timeIntervalOptions}
              value={value.muteTimeIntervals ?? []}
              onChange={(opts) => onChange({ ...value, muteTimeIntervals: opts.map((opt) => opt.value ?? '') })}
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
            <MultiSelect
              aria-label={t('alerting.simplified-routing-fields.active-timings', 'Active timings')}
              placeholder={t('alerting.simplified-routing-fields.select-time-intervals', 'Select time intervals...')}
              options={timeIntervalOptions}
              value={value.activeTimeIntervals ?? []}
              onChange={(opts) => onChange({ ...value, activeTimeIntervals: opts.map((opt) => opt.value ?? '') })}
            />
          </Field>

          <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
            <InlineField
              label={t('alerting.simplified-routing-fields.override-grouping', 'Override grouping')}
              transparent
              disabled={disabled}
              className={styles.switchElement}
            >
              <Switch
                id="override-grouping-toggle"
                value={overrideGrouping}
                onChange={(e) => {
                  const next = e.currentTarget.checked;
                  setOverrideGrouping(next);
                  // Turning the override off must drop groupBy too, or a caller that persists
                  // `value` still ships the override the summary text claims no longer applies.
                  if (!next) {
                    onChange({ ...value, groupBy: undefined });
                  }
                }}
              />
            </InlineField>
            {!overrideGrouping && (
              <Text variant="body" color="secondary">
                <Trans
                  i18nKey="alerting.simplified-routing-fields.grouping-summary"
                  values={{ fields: REQUIRED_GROUP_BY_LABELS.join(', ') }}
                >
                  Grouping: <strong>{'{{fields}}'}</strong>
                </Trans>
              </Text>
            )}
          </Stack>
          {overrideGrouping && (
            <GroupByField
              value={value.groupBy ?? []}
              onChange={(groupBy) => onChange({ ...value, groupBy })}
              disabled={disabled}
            />
          )}

          <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
            <InlineField
              label={t('alerting.simplified-routing-fields.override-timings', 'Override timings')}
              transparent
              disabled={disabled}
              className={styles.switchElement}
            >
              <Switch
                id="override-timings-toggle"
                value={overrideTimings}
                onChange={(e) => {
                  const next = e.currentTarget.checked;
                  setOverrideTimings(next);
                  // Same reasoning as the grouping switch above: drop the timing fields on opt-out.
                  if (!next) {
                    onChange({ ...value, groupWait: undefined, groupInterval: undefined, repeatInterval: undefined });
                  }
                }}
              />
            </InlineField>
            {!overrideTimings && (
              <Text variant="body" color="secondary">
                <Trans
                  i18nKey="alerting.simplified-routing-fields.timings-summary"
                  values={{
                    groupWait: TIMING_DEFAULTS.groupWait,
                    groupInterval: TIMING_DEFAULTS.groupInterval,
                    repeatInterval: TIMING_DEFAULTS.repeatInterval,
                  }}
                >
                  Group wait: <strong>{'{{groupWait}}'}</strong>, Group interval: <strong>{'{{groupInterval}}'}</strong>
                  , Repeat interval: <strong>{'{{repeatInterval}}'}</strong>
                </Trans>
              </Text>
            )}
          </Stack>
          {overrideTimings && (
            <Stack direction="column" gap={1}>
              <DurationField
                label={t('alerting.simplified-routing-fields.group-wait', 'Group wait')}
                value={value.groupWait ?? ''}
                placeholder={TIMING_DEFAULTS.groupWait}
                onChange={(groupWait) => onChange({ ...value, groupWait })}
                disabled={disabled}
              />
              <DurationField
                label={t('alerting.simplified-routing-fields.group-interval', 'Group interval')}
                value={value.groupInterval ?? ''}
                placeholder={TIMING_DEFAULTS.groupInterval}
                onChange={(groupInterval) => onChange({ ...value, groupInterval })}
                disabled={disabled}
              />
              <DurationField
                label={t('alerting.simplified-routing-fields.repeat-interval', 'Repeat interval')}
                value={value.repeatInterval ?? ''}
                placeholder={TIMING_DEFAULTS.repeatInterval}
                onChange={(repeatInterval) => onChange({ ...value, repeatInterval })}
                disabled={disabled}
              />
            </Stack>
          )}
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
  switchElement: css({
    flexFlow: 'row-reverse',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
});
