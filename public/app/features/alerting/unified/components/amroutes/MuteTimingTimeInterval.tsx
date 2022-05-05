import { css } from '@emotion/css';
import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Input, Field, FieldSet, useStyles2 } from '@grafana/ui';

import { MuteTimingFields } from '../../types/mute-timing-form';
import { DAYS_OF_THE_WEEK, MONTHS, validateArrayField, defaultTimeInterval } from '../../utils/mute-timings';

import { MuteTimingTimeRange } from './MuteTimingTimeRange';

export const MuteTimingTimeInterval = () => {
  const styles = useStyles2(getStyles);
  const { formState, register } = useFormContext();
  const {
    fields: timeIntervals,
    append: addTimeInterval,
    remove: removeTimeInterval,
  } = useFieldArray<MuteTimingFields>({
    name: 'time_intervals',
  });

  return (
    <FieldSet className={styles.timeIntervalLegend} label="Time intervals">
      <>
        <p>
          A time interval is a definition for a moment in time. All fields are lists, and at least one list element must
          be satisfied to match the field. If a field is left blank, any moment of time will match the field. For an
          instant of time to match a complete time interval, all fields must match. A mute timing can contain multiple
          time intervals.
        </p>
        {timeIntervals.map((timeInterval, timeIntervalIndex) => {
          const errors = formState.errors;
          return (
            <div key={timeInterval.id} className={styles.timeIntervalSection}>
              <MuteTimingTimeRange intervalIndex={timeIntervalIndex} />
              <Field
                label="Days of the week"
                error={errors.time_intervals?.[timeIntervalIndex]?.weekdays?.message ?? ''}
                invalid={!!errors.time_intervals?.[timeIntervalIndex]?.weekdays}
              >
                <Input
                  {...register(`time_intervals.${timeIntervalIndex}.weekdays`, {
                    validate: (value) =>
                      validateArrayField(
                        value,
                        (day) => DAYS_OF_THE_WEEK.includes(day.toLowerCase()),
                        'Invalid day of the week'
                      ),
                  })}
                  className={styles.input}
                  data-testid="mute-timing-weekdays"
                  // @ts-ignore react-hook-form doesn't handle nested field arrays well
                  defaultValue={timeInterval.weekdays}
                  placeholder="Example: monday, tuesday:thursday"
                />
              </Field>
              <Field
                label="Days of the month"
                description="The days of the month, 1-31, of a month. Negative values can be used to represent days which begin at the end of the month"
                invalid={!!errors.time_intervals?.[timeIntervalIndex]?.days_of_month}
                error={errors.time_intervals?.[timeIntervalIndex]?.days_of_month?.message}
              >
                <Input
                  {...register(`time_intervals.${timeIntervalIndex}.days_of_month`, {
                    validate: (value) =>
                      validateArrayField(
                        value,
                        (day) => {
                          const parsedDay = parseInt(day, 10);
                          return (parsedDay > -31 && parsedDay < 0) || (parsedDay > 0 && parsedDay < 32);
                        },
                        'Invalid day'
                      ),
                  })}
                  className={styles.input}
                  // @ts-ignore react-hook-form doesn't handle nested field arrays well
                  defaultValue={timeInterval.days_of_month}
                  placeholder="Example: 1, 14:16, -1"
                  data-testid="mute-timing-days"
                />
              </Field>
              <Field
                label="Months"
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
                  className={styles.input}
                  placeholder="Example: 1:3, may:august, december"
                  // @ts-ignore react-hook-form doesn't handle nested field arrays well
                  defaultValue={timeInterval.months}
                  data-testid="mute-timing-months"
                />
              </Field>
              <Field
                label="Years"
                invalid={!!errors.time_intervals?.[timeIntervalIndex]?.years}
                error={errors.time_intervals?.[timeIntervalIndex]?.years?.message ?? ''}
              >
                <Input
                  {...register(`time_intervals.${timeIntervalIndex}.years`, {
                    validate: (value) => validateArrayField(value, (year) => /^\d{4}$/.test(year), 'Invalid year'),
                  })}
                  className={styles.input}
                  placeholder="Example: 2021:2022, 2030"
                  // @ts-ignore react-hook-form doesn't handle nested field arrays well
                  defaultValue={timeInterval.years}
                  data-testid="mute-timing-years"
                />
              </Field>
              <Button
                type="button"
                variant="destructive"
                icon="trash-alt"
                onClick={() => removeTimeInterval(timeIntervalIndex)}
              >
                Remove time interval
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="secondary"
          className={styles.removeTimeIntervalButton}
          onClick={() => {
            addTimeInterval(defaultTimeInterval);
          }}
          icon="plus"
        >
          Add another time interval
        </Button>
      </>
    </FieldSet>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  input: css`
    width: 400px;
  `,
  timeIntervalLegend: css`
    legend {
      font-size: 1.25rem;
    }
  `,
  timeIntervalSection: css`
    background-color: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(1)};
  `,
  removeTimeIntervalButton: css`
    margin-top: ${theme.spacing(1)};
  `,
});
