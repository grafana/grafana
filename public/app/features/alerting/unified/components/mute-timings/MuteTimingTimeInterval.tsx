import { css, cx } from '@emotion/css';
import { concat, uniq, upperFirst, without } from 'lodash';
import { useEffect, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Field, FieldSet, Icon, InlineSwitch, Input, Stack, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { MuteTimingFields } from '../../types/mute-timing-form';
import { DAYS_OF_THE_WEEK, MONTHS, defaultTimeInterval, validateArrayField } from '../../utils/mute-timings';

import { MuteTimingTimeRange } from './MuteTimingTimeRange';
import { TimezoneSelect } from './timezones';

export const MuteTimingTimeInterval = () => {
  const styles = useStyles2(getStyles);
  const { formState, register, setValue } = useFormContext<MuteTimingFields>();
  const {
    fields: timeIntervals,
    append: addTimeInterval,
    remove: removeTimeInterval,
  } = useFieldArray({
    name: 'time_intervals',
  });
  const { isGrafanaAlertmanager } = useAlertmanager();

  return (
    <FieldSet label={t('alerting.mute-timing-time-interval.label-time-intervals', 'Time intervals')}>
      <>
        <p>
          A time interval is a definition for a moment in time. All fields are lists, and at least one list element must
          be satisfied to match the field. If a field is left blank, any moment of time will match the field. For an
          instant of time to match a complete time interval, all fields must match. A mute timing can contain multiple
          time intervals.
        </p>
        <Stack direction="column" gap={2}>
          {timeIntervals.map((timeInterval, timeIntervalIndex) => {
            const errors = formState.errors;

            // manually register the "location" field, react-hook-form doesn't handle nested field arrays well and will refuse to set
            // the default value for the field when using "useFieldArray"
            register(`time_intervals.${timeIntervalIndex}.location`);

            return (
              <div key={timeInterval.id} className={styles.timeIntervalSection}>
                <MuteTimingTimeRange intervalIndex={timeIntervalIndex} />
                <Field
                  label={t('alerting.mute-timing-time-interval.label-location', 'Location')}
                  invalid={Boolean(errors.time_intervals?.[timeIntervalIndex]?.location)}
                  error={errors.time_intervals?.[timeIntervalIndex]?.location?.message}
                >
                  <TimezoneSelect
                    prefix={<Icon name="map-marker" />}
                    width={50}
                    onChange={(selectedTimezone) => {
                      setValue(`time_intervals.${timeIntervalIndex}.location`, selectedTimezone.value);
                    }}
                    // @ts-ignore react-hook-form doesn't handle nested field arrays well
                    defaultValue={{ label: timeInterval.location, value: timeInterval.location }}
                    data-testid="mute-timing-location"
                  />
                </Field>
                <Field label={t('alerting.mute-timing-time-interval.label-days-of-the-week', 'Days of the week')}>
                  <DaysOfTheWeek
                    onChange={(daysOfWeek) => {
                      setValue(`time_intervals.${timeIntervalIndex}.weekdays`, daysOfWeek);
                    }}
                    // @ts-ignore react-hook-form doesn't handle nested field arrays well
                    defaultValue={timeInterval.weekdays}
                  />
                </Field>
                <Field
                  label={t('alerting.mute-timing-time-interval.label-days-of-the-month', 'Days of the month')}
                  description="The days of the month, 1:31, of a month. Negative values can be used to represent days which begin at the end of the month"
                  invalid={!!errors.time_intervals?.[timeIntervalIndex]?.days_of_month}
                  error={errors.time_intervals?.[timeIntervalIndex]?.days_of_month?.message}
                >
                  <Input
                    {...register(`time_intervals.${timeIntervalIndex}.days_of_month`, {
                      validate: validateDaysOfMonth,
                    })}
                    width={50}
                    // @ts-ignore react-hook-form doesn't handle nested field arrays well
                    defaultValue={timeInterval.days_of_month}
                    placeholder={t(
                      'alerting.mute-timing-time-interval.mute-timing-days-placeholder-example',
                      'Example: 1, 14:16, -1'
                    )}
                    data-testid="mute-timing-days"
                  />
                </Field>
                <Field
                  label={t('alerting.mute-timing-time-interval.label-months', 'Months')}
                  description="The months of the year in either numerical or the full calendar month"
                  invalid={!!errors.time_intervals?.[timeIntervalIndex]?.months}
                  error={errors.time_intervals?.[timeIntervalIndex]?.months?.message}
                >
                  <Input
                    {...register(`time_intervals.${timeIntervalIndex}.months`, {
                      validate: (value) =>
                        validateArrayField(
                          value,
                          (month) => MONTHS.includes(month) || (parseInt(month, 10) < 13 && parseInt(month, 10) > 0),
                          'Invalid month'
                        ),
                    })}
                    width={50}
                    placeholder={t(
                      'alerting.mute-timing-time-interval.mute-timing-months-placeholder-example-mayaugust-december',
                      'Example: 1:3, may:august, december'
                    )}
                    // @ts-ignore react-hook-form doesn't handle nested field arrays well
                    defaultValue={timeInterval.months}
                    data-testid="mute-timing-months"
                  />
                </Field>
                <Field
                  label={t('alerting.mute-timing-time-interval.label-years', 'Years')}
                  invalid={!!errors.time_intervals?.[timeIntervalIndex]?.years}
                  error={errors.time_intervals?.[timeIntervalIndex]?.years?.message ?? ''}
                >
                  <Input
                    {...register(`time_intervals.${timeIntervalIndex}.years`, {
                      validate: (value) => validateArrayField(value, (year) => /^\d{4}$/.test(year), 'Invalid year'),
                    })}
                    width={50}
                    placeholder={t(
                      'alerting.mute-timing-time-interval.mute-timing-years-placeholder-example',
                      'Example: 2021:2022, 2030'
                    )}
                    // @ts-ignore react-hook-form doesn't handle nested field arrays well
                    defaultValue={timeInterval.years}
                    data-testid="mute-timing-years"
                  />
                </Field>
                <Stack direction="row" gap={2}>
                  <Button
                    type="button"
                    variant="destructive"
                    fill="outline"
                    icon="trash-alt"
                    onClick={() => removeTimeInterval(timeIntervalIndex)}
                  >
                    <Trans i18nKey="alerting.mute-timing-time-interval.remove-time-interval">
                      Remove time interval
                    </Trans>
                  </Button>
                  {/*
                    This switch is only available for Grafana Alertmanager, as for now, Grafana alert manager doesn't support this feature
                    It hanldes empty list as undefined making impossible the use of an empty list for disabling time interval
                  */}
                  {!isGrafanaAlertmanager && (
                    <InlineSwitch
                      id={`time_intervals.${timeIntervalIndex}.disable`}
                      label={t('alerting.mute-timing-time-interval.label-disable', 'Disable')}
                      showLabel
                      transparent
                      {...register(`time_intervals.${timeIntervalIndex}.disable`)}
                    />
                  )}
                </Stack>
              </div>
            );
          })}
        </Stack>
        <Button
          type="button"
          variant="secondary"
          className={styles.removeTimeIntervalButton}
          onClick={() => {
            addTimeInterval(defaultTimeInterval);
          }}
          icon="plus"
        >
          <Trans i18nKey="alerting.mute-timing-time-interval.add-another-time-interval">
            Add another time interval
          </Trans>
        </Button>
      </>
    </FieldSet>
  );
};

interface DaysOfTheWeekProps {
  defaultValue?: string;
  onChange: (input: string) => void;
}

const parseDays = (input: string): string[] => {
  const parsedDays = input
    .split(',')
    .map((day) => day.trim())
    // each "day" could still be a range of days, so we parse the range
    .flatMap((day) => (day.includes(':') ? parseWeekdayRange(day) : day))
    .map((day) => day.toLowerCase())
    // remove invalid weekdays
    .filter((day) => DAYS_OF_THE_WEEK.includes(day));

  return uniq(parsedDays);
};

export function validateDaysOfMonth(value: string | undefined) {
  return validateArrayField(
    value,
    (day) => {
      // Ensure the value contains ONLY digits with an optional negative sign
      // This rejects any non-numeric characters or mixed inputs like "3-10"
      if (!/^-?\d+$/.test(day)) {
        return false;
      }
      const parsedDay = parseInt(day, 10);
      return (parsedDay > -31 && parsedDay < 0) || (parsedDay > 0 && parsedDay < 32);
    },
    'Invalid day'
  );
}

// parse monday:wednesday to ["monday", "tuesday", "wednesday"]
function parseWeekdayRange(input: string): string[] {
  const [start = '', end = ''] = input.split(':');

  const startIndex = DAYS_OF_THE_WEEK.indexOf(start);
  const endIndex = DAYS_OF_THE_WEEK.indexOf(end);

  return DAYS_OF_THE_WEEK.slice(startIndex, endIndex + 1);
}

const DaysOfTheWeek = ({ defaultValue = '', onChange }: DaysOfTheWeekProps) => {
  const styles = useStyles2(getStyles);
  const defaultValues = parseDays(defaultValue);
  const [selectedDays, setSelectedDays] = useState<string[]>(defaultValues);

  const toggleDay = (day: string) => {
    selectedDays.includes(day)
      ? setSelectedDays((selectedDays) => without(selectedDays, day))
      : setSelectedDays((selectedDays) => concat(selectedDays, day));
  };

  useEffect(() => {
    onChange(selectedDays.join(', '));
  }, [selectedDays, onChange]);

  return (
    <div data-testid="mute-timing-weekdays">
      <Stack gap={1}>
        {DAYS_OF_THE_WEEK.map((day) => {
          const style = cx(styles.dayOfTheWeek, selectedDays.includes(day) && 'selected');
          const abbreviated = day.slice(0, 3);

          return (
            <button type="button" key={day} className={style} onClick={() => toggleDay(day)}>
              {upperFirst(abbreviated)}
            </button>
          );
        })}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  input: css({
    width: '400px',
  }),
  timeIntervalSection: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(2),
  }),
  removeTimeIntervalButton: css({
    marginTop: theme.spacing(2),
  }),
  dayOfTheWeek: css({
    cursor: 'pointer',
    userSelect: 'none',
    padding: `${theme.spacing(1)} ${theme.spacing(3)}`,

    border: `solid 1px ${theme.colors.border.medium}`,
    background: 'none',
    borderRadius: theme.shape.radius.default,

    color: theme.colors.text.secondary,

    '&.selected': {
      fontWeight: theme.typography.fontWeightBold,
      color: theme.colors.primary.text,
      borderColor: theme.colors.primary.border,
      background: theme.colors.primary.transparent,
    },
  }),
});
