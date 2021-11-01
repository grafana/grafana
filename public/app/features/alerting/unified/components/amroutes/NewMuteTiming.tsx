import React from 'react';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { Field, FieldSet, IconButton, Input, Label, Button, useStyles2 } from '@grafana/ui';
import { useForm, useFieldArray } from 'react-hook-form';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { MuteTimeInterval, TimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { omitBy, isUndefined } from 'lodash';
import { AlertManagerPicker } from '../AlertManagerPicker';
import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';

interface Props {}

type MuteTimingFields = {
  name: string;
  time_range: Array<{
    start_time: string;
    end_time: string;
  }>;
  weekdays: string;
  days_of_month: string;
  months: string;
  years: string;
};

const defaultValues: MuteTimingFields = {
  name: '',
  time_range: [{ start_time: '', end_time: '' }],
  weekdays: '',
  days_of_month: '',
  months: '',
  years: '',
};

const convertStringToArray = (str: string) => str.split(',').map((s) => s.trim());

const createMuteTiming = (fields: MuteTimingFields): MuteTimeInterval => {
  const timeInterval: TimeInterval = {
    time_range: fields.time_range,
    weekdays: convertStringToArray(fields.weekdays),
    days_of_month: convertStringToArray(fields.days_of_month),
    months: convertStringToArray(fields.months),
    years: convertStringToArray(fields.years),
  };

  return {
    name: fields.name,
    time_intervals: [omitBy(timeInterval, isUndefined)],
  };
};

const onSubmit = (values: MuteTimingFields) => {
  const muteTiming = createMuteTiming(values);
  console.log(muteTiming);
};

const NewMuteTiming = (props: Props) => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const styles = useStyles2(getStyles);
  const formApi = useForm({ defaultValues });
  const { fields: timeRanges = [], append, remove } = useFieldArray<MuteTimingFields>({
    name: 'time_range',
    control: formApi.control,
  });
  return (
    <AlertingPageWrapper pageId="am-routes">
      <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      <form onSubmit={(e) => e.preventDefault()}>
        <FieldSet label={'Create mute timing'}>
          <Field
            required
            label="Name"
            description="A unique name for the mute timing"
            invalid={!!formApi.formState.errors?.name}
            error={formApi.formState.errors.name?.message}
          >
            <Input {...formApi.register('name', { required: true })} className={styles.input} />
          </Field>
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
                        {...formApi.register(`time_range.${index}.start_time`)}
                        className={styles.timeRangeInput}
                        defaultValue={timeRange.start_time}
                        placeholder="HH:MM"
                      />
                      <Label>End time</Label>
                      <Input
                        {...formApi.register(`time_range.${index}.end_time`)}
                        className={styles.timeRangeInput}
                        defaultValue={timeRange.end_time}
                        placeholder="HH:MM"
                      />
                    </div>
                    <div>
                      <IconButton
                        className={styles.deleteTimeRange}
                        title={'Remove'}
                        name={'trash-alt'}
                        onClick={() => remove(index)}
                      />
                    </div>
                  </div>
                );
              })}
              <Button variant="secondary" icon={'plus'} onClick={() => append({ start_time: '', end_time: '' })}>
                Add another time range
              </Button>
            </>
          </Field>
          <Field label="Days of the week">
            <Input
              {...formApi.register('weekdays')}
              className={styles.input}
              placeholder="Example: monday, tuesday:thursday"
            />
          </Field>
          <Field
            label="Days of the month"
            description="The days of the month, 1-31, of a month. Negative values can be used to represent days which begin at the end of the month"
          >
            <Input
              {...formApi.register('days_of_month')}
              className={styles.input}
              placeholder="Example: 1, 14:16, -1"
            />
          </Field>
          <Field label="Months" description="The months of the year in either numerical or the full calendar month">
            <Input
              {...formApi.register('months')}
              className={styles.input}
              placeholder="Example: 1:3, may:august, december"
            />
          </Field>
          <Field label="Years">
            <Input {...formApi.register('years')} className={styles.input} placeholder="Example: 2021:2022, 2030" />
          </Field>
          <Button onClick={formApi.handleSubmit(onSubmit)}>Submit</Button>
        </FieldSet>
      </form>
    </AlertingPageWrapper>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  input: css`
    width: 400px;
  `,
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

export default NewMuteTiming;
