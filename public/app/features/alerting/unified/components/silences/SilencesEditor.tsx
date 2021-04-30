import { Silence, SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { Button, Field, FieldSet, Input, TextArea, useStyles } from '@grafana/ui';
import { DefaultTimeZone, GrafanaTheme } from '@grafana/data';
import { config } from '@grafana/runtime';
import { pickBy } from 'lodash';
import MatchersField from './MatchersField';
import { useForm, FormProvider } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';
import { useDispatch } from 'react-redux';
import { createSilence } from '../../state/actions';
import { SilencePeriod } from './SilencePeriod';
import { css } from '@emotion/css';

interface Props {
  silence?: Silence;
  alertManagerSourceName: string;
}

const getDefaultFormValues = (silence?: Silence): SilenceFormFields => {
  if (silence) {
    const duration = Date.parse(silence.endsAt) - Date.parse(silence.startsAt);
    return {
      id: silence.id,
      startsAt: silence.startsAt,
      endsAt: silence.endsAt,
      comment: silence.comment,
      createdBy: silence.createdBy,
      duration: `${duration} ms`,
      isRegex: false,
      matchers: silence.matchers || [],
      matcherName: '',
      matcherValue: '',
      timeZone: DefaultTimeZone,
    };
  } else {
    return {
      id: '',
      startsAt: new Date().toISOString(),
      endsAt: '',
      comment: '',
      createdBy: config.bootData.user.name,
      duration: '',
      isRegex: false,
      matchers: [],
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

  const { register, handleSubmit } = formAPI;

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
    );
    dispatch(createSilence(alertManagerSourceName, payload as SilenceCreatePayload, true));
  };
  return (
    <FormProvider {...formAPI}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldSet label={`${silence ? 'Edit silence' : 'Silence alert'}`}>
          <SilencePeriod />
          <MatchersField />
          <Field className={styles.field} label="Comment" required>
            <TextArea {...register('comment', { required: true })} />
          </Field>
          <Field className={styles.field} label="Created by" required>
            <Input {...register('createdBy', { required: true })} />
          </Field>
        </FieldSet>
        <Button type="submit">Submit</Button>
      </form>
    </FormProvider>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  field: css`
    margin: ${theme.spacing.sm} 0;
  `,
});

export default SilencesEditor;
