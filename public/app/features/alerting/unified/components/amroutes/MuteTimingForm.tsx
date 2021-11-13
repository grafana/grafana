import React, { useCallback, useEffect, useMemo } from 'react';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { Field, FieldSet, Input, Button, useStyles2 } from '@grafana/ui';
import { FormProvider, useForm, useFieldArray } from 'react-hook-form';
import { GrafanaTheme2 } from '@grafana/data';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { AlertmanagerConfig, MuteTimeInterval, TimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { omitBy, isUndefined } from 'lodash';
import { AlertManagerPicker } from '../AlertManagerPicker';
import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';
import { fetchAlertManagerConfigAction, updateAlertManagerConfigAction } from '../../state/actions';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { initialAsyncRequestState } from '../../utils/redux';
import { MuteTimingTimeRange } from './MuteTimingTimeRange';

interface Props {
  muteTiming?: string;
}

export type MuteTimingFields = {
  name: string;
  time_intervals: MuteTimingIntervalFields[];
};

type MuteTimingIntervalFields = {
  times: Array<{
    start_time: string;
    end_time: string;
  }>;
  weekdays: string;
  days_of_month: string;
  months: string;
  years: string;
};

const defaultTimeInterval: MuteTimingIntervalFields = {
  times: [{ start_time: '', end_time: '' }],
  weekdays: '',
  days_of_month: '',
  months: '',
  years: '',
};

const useDefaultValues = (config: AlertmanagerConfig, muteTiming?: string): MuteTimingFields => {
  return useMemo(() => {
    const defaultValues = {
      name: '',
      time_intervals: [defaultTimeInterval],
    };

    if (muteTiming) {
      const mute = config?.mute_time_intervals?.find(({ name }) => name === muteTiming);
      if (mute) {
        const intervals = mute.time_intervals.map((interval) => ({
          times: interval.times ?? defaultTimeInterval.times,
          weekdays: interval?.weekdays?.join(', ') ?? defaultTimeInterval.weekdays,
          days_of_month: interval?.days_of_month?.join(', ') ?? defaultTimeInterval.days_of_month,
          months: interval?.months?.join(', ') ?? defaultTimeInterval.months,
          years: interval?.years?.join(', ') ?? defaultTimeInterval.years,
        }));
        return {
          name: mute.name,
          time_intervals: intervals,
        };
      } else {
        return defaultValues;
      }
    } else {
      return defaultValues;
    }
  }, [config, muteTiming]);
};

const convertStringToArray = (str: string) => {
  return str ? str.split(',').map((s) => s.trim()) : undefined;
};

const createMuteTiming = (fields: MuteTimingFields): MuteTimeInterval => {
  const timeIntervals: TimeInterval[] = fields.time_intervals.map(
    ({ times, weekdays, days_of_month, months, years }) => {
      const interval = {
        times: times.filter(({ start_time, end_time }) => !!start_time && !!end_time),
        weekdays: convertStringToArray(weekdays),
        days_of_month: convertStringToArray(days_of_month),
        months: convertStringToArray(months),
        years: convertStringToArray(years),
      };

      return omitBy(interval, isUndefined);
    }
  );

  return {
    name: fields.name,
    time_intervals: timeIntervals,
  };
};

const MuteTimingForm = ({ muteTiming }: Props) => {
  const dispatch = useDispatch();
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const styles = useStyles2(getStyles);

  const fetchConfig = useCallback(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);
  const { result, loading } = (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;

  const config = result?.alertmanager_config;
  const defaultValues = useDefaultValues(config, muteTiming);
  const formApi = useForm({ defaultValues });
  const {
    fields: timeIntervals,
    append: addTimeInterval,
    remove: removeTimeInterval,
  } = useFieldArray<MuteTimingFields>({
    name: 'time_intervals',
    control: formApi.control,
  });

  const onSubmit = (values: MuteTimingFields) => {
    const muteTiming = createMuteTiming(values);

    const newConfig = {
      ...result,
      alertmanager_config: {
        ...config,
        mute_time_intervals: [...(config?.mute_time_intervals || []), muteTiming],
      },
    };

    dispatch(
      updateAlertManagerConfigAction({
        newConfig,
        oldConfig: result,
        alertManagerSourceName: alertManagerSourceName!,
        successMessage: 'Mute timing saved',
        redirectPath: '/alerting/routes/',
      })
    );
  };

  return (
    <AlertingPageWrapper pageId="am-routes">
      <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      {result && !loading && (
        <FormProvider {...formApi}>
          <form onSubmit={formApi.handleSubmit(onSubmit)}>
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
              <FieldSet label="Time intervals">
                {timeIntervals.map((timeInterval, timeIntervalIndex) => {
                  return (
                    <div key={timeInterval.id} className={styles.timeIntervalSection}>
                      <MuteTimingTimeRange intervalIndex={timeIntervalIndex} />
                      <Field label="Days of the week">
                        <Input
                          {...formApi.register(`time_intervals.${timeIntervalIndex}.weekdays`)}
                          className={styles.input}
                          // @ts-ignore react-hook-form doesn't handle nested field arrays well
                          defaultValue={timeInterval.weekdays}
                          placeholder="Example: monday, tuesday:thursday"
                        />
                      </Field>
                      <Field
                        label="Days of the month"
                        description="The days of the month, 1-31, of a month. Negative values can be used to represent days which begin at the end of the month"
                      >
                        <Input
                          {...formApi.register(`time_intervals.${timeIntervalIndex}.days_of_month`)}
                          className={styles.input}
                          // @ts-ignore react-hook-form doesn't handle nested field arrays well
                          defaultValue={timeInterval.days_of_month}
                          placeholder="Example: 1, 14:16, -1"
                        />
                      </Field>
                      <Field
                        label="Months"
                        description="The months of the year in either numerical or the full calendar month"
                      >
                        <Input
                          {...formApi.register(`time_intervals.${timeIntervalIndex}.months`)}
                          className={styles.input}
                          placeholder="Example: 1:3, may:august, december"
                          // @ts-ignore react-hook-form doesn't handle nested field arrays well
                          defaultValue={timeInterval.months}
                        />
                      </Field>
                      <Field label="Years">
                        <Input
                          {...formApi.register(`time_intervals.${timeIntervalIndex}.years`)}
                          className={styles.input}
                          placeholder="Example: 2021:2022, 2030"
                          // @ts-ignore react-hook-form doesn't handle nested field arrays well
                          defaultValue={timeInterval.years}
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
                >
                  Add another time interval
                </Button>
              </FieldSet>
              <Button type="submit">Submit</Button>
            </FieldSet>
          </form>
        </FormProvider>
      )}
    </AlertingPageWrapper>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  input: css`
    width: 400px;
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

export default MuteTimingForm;
