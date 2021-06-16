import { Silence, SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';
import React, { FC, useState } from 'react';
import { Button, Field, FieldSet, Input, LinkButton, TextArea, useStyles } from '@grafana/ui';
import {
  DefaultTimeZone,
  GrafanaTheme,
  parseDuration,
  intervalToAbbreviatedDurationString,
  addDurationToDate,
  dateTime,
  isValidDate,
} from '@grafana/data';
import { useDebounce } from 'react-use';
import { config } from '@grafana/runtime';
import { pickBy } from 'lodash';
import MatchersField from './MatchersField';
import { useForm, FormProvider } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';
import { useDispatch } from 'react-redux';
import { createOrUpdateSilenceAction } from '../../state/actions';
import { SilencePeriod } from './SilencePeriod';
import { css, cx } from '@emotion/css';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { makeAMLink } from '../../utils/misc';
import { useCleanup } from 'app/core/hooks/useCleanup';

interface Props {
  silence?: Silence;
  alertManagerSourceName: string;
}

const getDefaultFormValues = (silence?: Silence): SilenceFormFields => {
  const now = new Date();
  if (silence) {
    const isExpired = Date.parse(silence.endsAt) < Date.now();
    const interval = isExpired
      ? {
          start: now,
          end: addDurationToDate(now, { hours: 2 }),
        }
      : { start: new Date(silence.startsAt), end: new Date(silence.endsAt) };
    return {
      id: silence.id,
      startsAt: interval.start.toISOString(),
      endsAt: interval.end.toISOString(),
      comment: silence.comment,
      createdBy: silence.createdBy,
      duration: intervalToAbbreviatedDurationString(interval),
      isRegex: false,
      matchers: silence.matchers || [],
      matcherName: '',
      matcherValue: '',
      timeZone: DefaultTimeZone,
    };
  } else {
    const endsAt = addDurationToDate(now, { hours: 2 }); // Default time period is now + 2h
    return {
      id: '',
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      comment: '',
      createdBy: config.bootData.user.name,
      duration: '2h',
      isRegex: false,
      matchers: [{ name: '', value: '', isRegex: false }],
      matcherName: '',
      matcherValue: '',
      timeZone: DefaultTimeZone,
    };
  }
};

export const SilencesEditor: FC<Props> = ({ silence, alertManagerSourceName }) => {
  const formAPI = useForm({ defaultValues: getDefaultFormValues(silence) });
  const dispatch = useDispatch();
  const styles = useStyles(getStyles);

  const { loading } = useUnifiedAlertingSelector((state) => state.updateSilence);

  useCleanup((state) => state.unifiedAlerting.updateSilence);

  const { register, handleSubmit, formState, watch, setValue, clearErrors } = formAPI;

  const onSubmit = (data: SilenceFormFields) => {
    const { id, startsAt, endsAt, comment, createdBy, matchers } = data;
    const payload = pickBy(
      {
        id,
        startsAt,
        endsAt,
        comment,
        createdBy,
        matchers,
      },
      (value) => !!value
    ) as SilenceCreatePayload;
    dispatch(
      createOrUpdateSilenceAction({
        alertManagerSourceName,
        payload,
        exitOnSave: true,
        successMessage: `Silence ${payload.id ? 'updated' : 'created'}`,
      })
    );
  };

  const duration = watch('duration');
  const startsAt = watch('startsAt');
  const endsAt = watch('endsAt');

  // Keep duration and endsAt in sync
  const [prevDuration, setPrevDuration] = useState(duration);
  useDebounce(
    () => {
      if (isValidDate(startsAt) && isValidDate(endsAt)) {
        if (duration !== prevDuration) {
          setValue('endsAt', dateTime(addDurationToDate(new Date(startsAt), parseDuration(duration))).toISOString());
          setPrevDuration(duration);
        } else {
          const startValue = new Date(startsAt).valueOf();
          const endValue = new Date(endsAt).valueOf();
          if (endValue > startValue) {
            const nextDuration = intervalToAbbreviatedDurationString({
              start: new Date(startsAt),
              end: new Date(endsAt),
            });
            setValue('duration', nextDuration);
            setPrevDuration(nextDuration);
          }
        }
      }
    },
    700,
    [clearErrors, duration, endsAt, prevDuration, setValue, startsAt]
  );

  return (
    <FormProvider {...formAPI}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldSet label={`${silence ? 'Recreate silence' : 'Create silence'}`}>
          <div className={styles.flexRow}>
            <SilencePeriod />
            <Field
              label="Duration"
              invalid={!!formState.errors.duration}
              error={
                formState.errors.duration &&
                (formState.errors.duration.type === 'required' ? 'Required field' : formState.errors.duration.message)
              }
            >
              <Input
                className={styles.createdBy}
                {...register('duration', {
                  validate: (value) =>
                    Object.keys(parseDuration(value)).length === 0
                      ? 'Invalid duration. Valid example: 1d 4h (Available units: y, M, w, d, h, m, s)'
                      : undefined,
                })}
                id="duration"
              />
            </Field>
          </div>

          <MatchersField />
          <Field
            className={cx(styles.field, styles.textArea)}
            label="Comment"
            required
            error={formState.errors.comment?.message}
            invalid={!!formState.errors.comment}
          >
            <TextArea {...register('comment', { required: { value: true, message: 'Required.' } })} />
          </Field>
          <Field
            className={cx(styles.field, styles.createdBy)}
            label="Created by"
            required
            error={formState.errors.createdBy?.message}
            invalid={!!formState.errors.createdBy}
          >
            <Input {...register('createdBy', { required: { value: true, message: 'Required.' } })} />
          </Field>
        </FieldSet>
        <div className={styles.flexRow}>
          {loading && (
            <Button disabled={true} icon="fa fa-spinner" variant="primary">
              Saving...
            </Button>
          )}
          {!loading && <Button type="submit">Submit</Button>}
          <LinkButton
            href={makeAMLink('alerting/silences', alertManagerSourceName)}
            variant={'secondary'}
            fill="outline"
          >
            Cancel
          </LinkButton>
        </div>
      </form>
    </FormProvider>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  field: css`
    margin: ${theme.spacing.sm} 0;
  `,
  textArea: css`
    width: 600px;
  `,
  createdBy: css`
    width: 200px;
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;

    & > * {
      margin-right: ${theme.spacing.sm};
    }
  `,
});

export default SilencesEditor;
