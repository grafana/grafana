import { css } from '@emotion/css';
import { useController, useFormContext } from 'react-hook-form';

import { dateTime } from '@grafana/data';
import { Field, TimeRangeInput } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { SilenceFormFields } from '../../types/silence-form';

export const SilencePeriod = () => {
  const { control, getValues } = useFormContext<SilenceFormFields>();

  const {
    field: { onChange: onChangeStartsAt, value: startsAt },
    fieldState: { invalid: startsAtInvalid },
  } = useController({
    name: 'startsAt',
    control,
    rules: {
      validate: (value) => getValues().endsAt > value,
    },
  });

  const {
    field: { onChange: onChangeEndsAt, value: endsAt },
    fieldState: { invalid: endsAtInvalid },
  } = useController({
    name: 'endsAt',
    control,
    rules: {
      validate: (value) => getValues().startsAt < value,
    },
  });

  const {
    field: { onChange: onChangeTimeZone, value: timeZone },
  } = useController({
    name: 'timeZone',
    control,
  });

  const invalid = startsAtInvalid || endsAtInvalid;

  const from = dateTime(startsAt);
  const to = dateTime(endsAt);

  return (
    <Field
      className={styles.timeRange}
      label={t('alerting.silence-period.label-silence-start-and-end', 'Silence start and end')}
      error={invalid ? 'To is before or the same as from' : ''}
      invalid={invalid}
    >
      <TimeRangeInput
        value={{
          from,
          to,
          raw: {
            from,
            to,
          },
        }}
        timeZone={timeZone}
        onChange={(newValue) => {
          onChangeStartsAt(dateTime(newValue.from));
          onChangeEndsAt(dateTime(newValue.to));
        }}
        onChangeTimeZone={(newValue) => onChangeTimeZone(newValue)}
        hideTimeZone={false}
        hideQuickRanges={true}
        placeholder={t('alerting.silence-period.placeholder-select-time-range', 'Select time range')}
      />
    </Field>
  );
};

const styles = {
  timeRange: css({
    width: '400px',
  }),
};
