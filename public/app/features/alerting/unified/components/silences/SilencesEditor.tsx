import { Silence, SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { Button, Field, FieldSet, Input, TextArea } from '@grafana/ui';
import { DefaultTimeZone } from '@grafana/data';
import MatchersField from './MatchersField';
import { useForm, FormProvider } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';
import { useDispatch } from 'react-redux';
import { createSilence } from '../../state/actions';
import { pickBy } from 'lodash';
import { SilencePeriod } from './SilencePeriod';

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
      createdBy: '',
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
        <FieldSet label="Edit silence">
          <SilencePeriod />
          <MatchersField />
          <Field label="Comment" required>
            <TextArea {...register('comment', { required: true })} />
          </Field>
          <Field label="Created by" required>
            <Input {...register('createdBy', { required: true })} />
          </Field>
        </FieldSet>
        <Button type="submit">Submit</Button>
      </form>
    </FormProvider>
  );
};

export default SilencesEditor;
