import React, { FC } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { MuteTimingFields } from './MuteTimingForm';
import { Field, Input, Label, Button, IconButton, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

interface Props {
  intervalIndex: number;
}

export const MuteTimingTimeRange: FC<Props> = ({ intervalIndex }) => {
  const styles = useStyles2(getStyles);
  const { register } = useFormContext();

  const { fields: timeRanges, append: addTimeRange, remove: removeTimeRange } = useFieldArray<MuteTimingFields>({
    name: `time_intervals.${intervalIndex}.times`,
  });

  return (
    <div>
      <Field
        label="Time range"
        description="The time inclusive of the starting time and exclusive of the end time in UTC"
      >
        <>
          {timeRanges.map((timeRange, index) => {
            return (
              <div className={styles.timeRangeSection} key={timeRange.id}>
                <div className={styles.timeRange}>
                  <Label>Start time</Label>
                  <Input
                    {...register(`time_intervals.${intervalIndex}.times.${index}.start_time`)}
                    className={styles.timeRangeInput}
                    // @ts-ignore react-hook-form doesn't handle nested field arrays well
                    defaultValue={timeRange.start_time}
                    placeholder="HH:MM"
                  />
                  <Label>End time</Label>
                  <Input
                    {...register(`time_intervals.${intervalIndex}.times.${index}.end_time`)}
                    className={styles.timeRangeInput}
                    // @ts-ignore react-hook-form doesn't handle nested field arrays well
                    defaultValue={timeRange.end_time}
                    placeholder="HH:MM"
                  />
                </div>
                <div>
                  <IconButton
                    className={styles.deleteTimeRange}
                    title={'Remove'}
                    name={'trash-alt'}
                    onClick={() => removeTimeRange(index)}
                  />
                </div>
              </div>
            );
          })}

          <Button
            variant="secondary"
            type="button"
            icon={'plus'}
            onClick={() => addTimeRange({ start_time: '', end_time: '' })}
          >
            Add another time range
          </Button>
        </>
      </Field>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  timeRangeSection: css`
    display: flex;
    align-items: center;
    margin-left: ${theme.spacing(2)};
    gap: ${theme.spacing(1)};
  `,
  timeRange: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  timeRangeInput: css`
    width: 120px;
  `,
  deleteTimeRange: css`
    margin-bottom: ${theme.spacing(4)};
  `,
});
