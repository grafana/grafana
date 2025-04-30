import { css } from '@emotion/css';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Icon, IconButton, InlineField, InlineFieldRow, Input, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { MuteTimingFields } from '../../types/mute-timing-form';
import ConditionalWrap from '../ConditionalWrap';

import { isValidStartAndEndTime, isvalidTimeFormat } from './util';

interface Props {
  intervalIndex: number;
}

const INVALID_FORMAT_MESSAGE = 'Times must be between 00:00 and 24:00 UTC';

export const MuteTimingTimeRange = ({ intervalIndex }: Props) => {
  const styles = useStyles2(getStyles);
  const { register, formState, getValues, watch } = useFormContext<MuteTimingFields>();
  const isDisabled = watch(`time_intervals.${intervalIndex}.disable`);

  const {
    fields: timeRanges,
    append: addTimeRange,
    remove: removeTimeRange,
  } = useFieldArray<MuteTimingFields>({
    name: `time_intervals.${intervalIndex}.times`,
  });

  const formErrors = formState.errors.time_intervals?.[intervalIndex];
  const timeRangeInvalid = formErrors?.times?.some?.((value) => value?.start_time || value?.end_time) ?? false;

  return (
    <div>
      <Field
        className={styles.field}
        label={t('alerting.mute-timing-time-range.label-time-range', 'Time range')}
        description={t(
          'alerting.mute-timing-time-range.description-time-range',
          'The time inclusive of the start and exclusive of the end time (in UTC if no location has been selected, otherwise local time)'
        )}
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
                    label={t('alerting.mute-timing-time-range.label-start-time', 'Start time')}
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
                      readOnly={isDisabled}
                      suffix={<Icon name="clock-nine" />}
                      // @ts-ignore react-hook-form doesn't handle nested field arrays well
                      defaultValue={timeRange.start_time}
                      placeholder={t('alerting.mute-timing-time-range.mute-timing-starts-at-placeholder-hhmm', 'HH:mm')}
                      data-testid="mute-timing-starts-at"
                    />
                  </InlineField>
                  <InlineField
                    label={t('alerting.mute-timing-time-range.label-end-time', 'End time')}
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
                      readOnly={isDisabled}
                      suffix={<Icon name="clock-nine" />}
                      // @ts-ignore react-hook-form doesn't handle nested field arrays well
                      defaultValue={timeRange.end_time}
                      placeholder={t('alerting.mute-timing-time-range.mute-timing-ends-at-placeholder-hhmm', 'HH:mm')}
                      data-testid="mute-timing-ends-at"
                    />
                  </InlineField>
                  <IconButton
                    className={styles.deleteTimeRange}
                    title={t('alerting.mute-timing-time-range.title-remove', 'Remove')}
                    name="trash-alt"
                    onClick={(e) => {
                      e.preventDefault();
                      removeTimeRange(index);
                    }}
                    tooltip={t('alerting.mute-timing-time-range.tooltip-remove-time-range', 'Remove time range')}
                  />
                </InlineFieldRow>
              </div>
            );
          })}
        </>
      </Field>
      <ConditionalWrap
        shouldWrap={isDisabled}
        wrap={(children) => (
          <Tooltip
            content={t(
              'alerting.mute-timing-time-range.content-this-time-interval-is-disabled',
              'This time interval is disabled'
            )}
            placement="right-start"
          >
            {children}
          </Tooltip>
        )}
      >
        <Button
          className={styles.addTimeRange}
          variant="secondary"
          type="button"
          icon="plus"
          disabled={isDisabled}
          onClick={() => addTimeRange({ start_time: '', end_time: '' })}
        >
          <Trans i18nKey="alerting.mute-timing-time-range.add-another-time-range">Add another time range</Trans>
        </Button>
      </ConditionalWrap>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  field: css({
    marginBottom: 0,
  }),
  timeRange: css({
    marginBottom: theme.spacing(1),
  }),
  timeRangeInput: css({
    width: '90px',
  }),
  deleteTimeRange: css({
    margin: `${theme.spacing(1)} 0 0 ${theme.spacing(0.5)}`,
  }),
  addTimeRange: css({
    marginBottom: theme.spacing(2),
  }),
});
