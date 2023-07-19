import { css } from '@emotion/css';
import React from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Icon, IconButton, InlineField, InlineFieldRow, Input, useStyles2 } from '@grafana/ui';

import { MuteTimingFields } from '../../types/mute-timing-form';

import { isValidStartAndEndTime, isvalidTimeFormat } from './util';

interface Props {
  intervalIndex: number;
}

const INVALID_FORMAT_MESSAGE = 'Times must be between 00:00 and 24:00 UTC';

export const MuteTimingTimeRange = ({ intervalIndex }: Props) => {
  const styles = useStyles2(getStyles);
  const { register, formState, getValues } = useFormContext<MuteTimingFields>();

  const {
    fields: timeRanges,
    append: addTimeRange,
    remove: removeTimeRange,
  } = useFieldArray<MuteTimingFields>({
    name: `time_intervals.${intervalIndex}.times`,
  });

  const formErrors = formState.errors.time_intervals?.[intervalIndex];
  const timeRangeInvalid = formErrors?.times?.some((value) => value?.start_time || value?.end_time) ?? false;

  return (
    <div>
      <Field
        className={styles.field}
        label="Time range"
        description="The time inclusive of the starting time and exclusive of the end time in UTC"
        invalid={timeRangeInvalid}
      >
        <>
          {timeRanges.map((timeRange, index) => {
            const timeRangeErrors = formErrors?.times?.[index];
            const startTimeKey = `time_intervals.${intervalIndex}.times.${index}.start_time`;
            const endTimeKey = `time_intervals.${intervalIndex}.times.${index}.end_time`;

            const getStartAndEndTime = (): [string | undefined, string | undefined] => {
              // @ts-ignore react-hook-form doesn't handle nested field arrays well
              const startTime: string = getValues(startTimeKey);
              // @ts-ignore react-hook-form doesn't handle nested field arrays well
              const endTime: string = getValues(endTimeKey);

              return [startTime, endTime];
            };

            return (
              <div className={styles.timeRange} key={timeRange.id}>
                <InlineFieldRow>
                  <InlineField
                    label="Start time"
                    invalid={Boolean(timeRangeErrors?.start_time)}
                    error={timeRangeErrors?.start_time?.message}
                  >
                    <Input
                      // @ts-ignore
                      {...register(startTimeKey, {
                        validate: (input: string) => {
                          const validFormat = isvalidTimeFormat(input);
                          if (!validFormat) {
                            return INVALID_FORMAT_MESSAGE;
                          }

                          const [startTime, endTime] = getStartAndEndTime();

                          if (isValidStartAndEndTime(startTime, endTime)) {
                            return;
                          } else {
                            return 'Start time must be before end time';
                          }
                        },
                      })}
                      className={styles.timeRangeInput}
                      maxLength={5}
                      suffix={<Icon name="clock-nine" />}
                      // @ts-ignore react-hook-form doesn't handle nested field arrays well
                      defaultValue={timeRange.start_time}
                      placeholder="HH:mm"
                      data-testid="mute-timing-starts-at"
                    />
                  </InlineField>
                  <InlineField
                    label="End time"
                    invalid={Boolean(timeRangeErrors?.end_time)}
                    error={timeRangeErrors?.end_time?.message}
                  >
                    <Input
                      {...register(`time_intervals.${intervalIndex}.times.${index}.end_time`, {
                        validate: (input: string) => {
                          const validFormat = isvalidTimeFormat(input);
                          if (!validFormat) {
                            return INVALID_FORMAT_MESSAGE;
                          }

                          const [startTime, endTime] = getStartAndEndTime();

                          if (isValidStartAndEndTime(startTime, endTime)) {
                            return;
                          } else {
                            return 'End time must be after start time';
                          }
                        },
                      })}
                      className={styles.timeRangeInput}
                      maxLength={5}
                      suffix={<Icon name="clock-nine" />}
                      // @ts-ignore react-hook-form doesn't handle nested field arrays well
                      defaultValue={timeRange.end_time}
                      placeholder="HH:mm"
                      data-testid="mute-timing-ends-at"
                    />
                  </InlineField>
                  <IconButton
                    className={styles.deleteTimeRange}
                    title="Remove"
                    name="trash-alt"
                    onClick={(e) => {
                      e.preventDefault();
                      removeTimeRange(index);
                    }}
                    tooltip="Remove time range"
                  />
                </InlineFieldRow>
              </div>
            );
          })}
        </>
      </Field>
      <Button
        className={styles.addTimeRange}
        variant="secondary"
        type="button"
        icon="plus"
        onClick={() => addTimeRange({ start_time: '', end_time: '' })}
      >
        Add another time range
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  field: css`
    margin-bottom: 0;
  `,
  timeRange: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  timeRangeInput: css`
    width: 90px;
  `,
  deleteTimeRange: css`
    margin: ${theme.spacing(1)} 0 0 ${theme.spacing(0.5)};
  `,
  addTimeRange: css`
    margin-bottom: ${theme.spacing(2)};
  `,
});
