import { css } from '@emotion/css';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, useStyles2 } from '@grafana/ui';
import MuteTimingsSelector from 'app/features/alerting/unified/components/alertmanager-entities/MuteTimingsSelector';
import { BaseAlertmanagerArgs } from 'app/features/alerting/unified/types/hooks';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { mapMultiSelectValueToStrings } from 'app/features/alerting/unified/utils/amroutes';

/** Provides a form field for use in simplified routing, for selecting appropriate mute timings */
export function MuteTimingFields({ alertmanager }: BaseAlertmanagerArgs) {
  const styles = useStyles2(getStyles);
  const {
    control,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  return (
    <Field
      label={t('alerting.mute-timing-fields.am-mute-timing-select-label-mute-timings', 'Mute timings')}
      data-testid="am-mute-timing-select"
      description={t(
        'alerting.mute-timing-fields.am-mute-timing-select-description-mute-timings',
        'Select a mute timing to define when not to send notifications for this alert rule'
      )}
      className={styles.muteTimingField}
      invalid={!!errors.contactPoints?.[alertmanager]?.muteTimeIntervals}
    >
      <Controller
        render={({ field: { onChange, ref, ...field } }) => (
          <MuteTimingsSelector
            alertmanager={alertmanager}
            selectProps={{
              ...field,
              onChange: (value) => onChange(mapMultiSelectValueToStrings(value)),
            }}
          />
        )}
        control={control}
        name={`contactPoints.${alertmanager}.muteTimeIntervals`}
      />
    </Field>
  );
}
const getStyles = (theme: GrafanaTheme2) => ({
  muteTimingField: css({
    marginTop: theme.spacing(1),
  }),
});
