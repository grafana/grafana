import { Trans, t } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

import { type RoutingTimings, TIMING_DEFAULTS } from '../../constants';
import { DurationField } from '../DurationField/DurationField';
import { OverrideSection } from '../OverrideSection/OverrideSection';

export interface TimingsOverrideProps {
  value: RoutingTimings;
  /** What the rule inherits for each unset timing, typically the selected policy tree's defaults.
   * Fields it leaves out fall back to Alertmanager's built-in defaults. */
  defaults?: RoutingTimings;
  /** Reports every edit as typed, so invalid durations reach the parent; gate saving on `isValidPromDuration`. */
  onChange: (value: RoutingTimings) => void;
  disabled?: boolean;
}

/** "Override timings" switch plus the group wait, group interval and repeat interval fields. */
export function TimingsOverride({ value, defaults, onChange, disabled }: TimingsOverrideProps) {
  const inherited = {
    groupWait: defaults?.groupWait ?? TIMING_DEFAULTS.groupWait,
    groupInterval: defaults?.groupInterval ?? TIMING_DEFAULTS.groupInterval,
    repeatInterval: defaults?.repeatInterval ?? TIMING_DEFAULTS.repeatInterval,
  };
  const overridden = Boolean(value.groupWait || value.groupInterval || value.repeatInterval);

  return (
    <OverrideSection
      label={t('alerting.timings-override.label', 'Override timings')}
      overridden={overridden}
      onToggle={(on) => {
        if (!on) {
          onChange({ groupWait: undefined, groupInterval: undefined, repeatInterval: undefined });
        }
      }}
      disabled={disabled}
      summary={
        <Text variant="body" color="secondary">
          <Trans i18nKey="alerting.timings-override.summary" values={inherited}>
            Group wait: <strong>{'{{groupWait}}'}</strong>, Group interval: <strong>{'{{groupInterval}}'}</strong>,
            Repeat interval: <strong>{'{{repeatInterval}}'}</strong>
          </Trans>
        </Text>
      }
    >
      <Stack direction="column" gap={1}>
        <DurationField
          label={t('alerting.timings-override.group-wait', 'Group wait')}
          value={value.groupWait ?? ''}
          placeholder={inherited.groupWait}
          onChange={(groupWait) => onChange({ ...value, groupWait })}
          disabled={disabled}
        />
        <DurationField
          label={t('alerting.timings-override.group-interval', 'Group interval')}
          value={value.groupInterval ?? ''}
          placeholder={inherited.groupInterval}
          allowZero={false}
          onChange={(groupInterval) => onChange({ ...value, groupInterval })}
          disabled={disabled}
        />
        <DurationField
          label={t('alerting.timings-override.repeat-interval', 'Repeat interval')}
          value={value.repeatInterval ?? ''}
          placeholder={inherited.repeatInterval}
          allowZero={false}
          onChange={(repeatInterval) => onChange({ ...value, repeatInterval })}
          disabled={disabled}
        />
      </Stack>
    </OverrideSection>
  );
}
