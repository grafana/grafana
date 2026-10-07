import { Trans, t } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

import { type RoutingTimings, TIMING_DEFAULTS } from '../../constants';
import { DurationField } from '../DurationField/DurationField';
import { OverrideSection } from '../OverrideSection/OverrideSection';

export interface TimingsOverrideProps {
  /** Plain Prometheus durations (e.g. `30s`); unset fields use the defaults. */
  value: RoutingTimings;
  onChange: (value: RoutingTimings) => void;
  disabled?: boolean;
}

/** "Override timings" switch plus the group wait, group interval and repeat interval fields. */
export function TimingsOverride({ value, onChange, disabled }: TimingsOverrideProps) {
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
          <Trans i18nKey="alerting.timings-override.summary" values={TIMING_DEFAULTS}>
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
          placeholder={TIMING_DEFAULTS.groupWait}
          onChange={(groupWait) => onChange({ ...value, groupWait })}
          disabled={disabled}
        />
        <DurationField
          label={t('alerting.timings-override.group-interval', 'Group interval')}
          value={value.groupInterval ?? ''}
          placeholder={TIMING_DEFAULTS.groupInterval}
          onChange={(groupInterval) => onChange({ ...value, groupInterval })}
          disabled={disabled}
        />
        <DurationField
          label={t('alerting.timings-override.repeat-interval', 'Repeat interval')}
          value={value.repeatInterval ?? ''}
          placeholder={TIMING_DEFAULTS.repeatInterval}
          onChange={(repeatInterval) => onChange({ ...value, repeatInterval })}
          disabled={disabled}
        />
      </Stack>
    </OverrideSection>
  );
}
