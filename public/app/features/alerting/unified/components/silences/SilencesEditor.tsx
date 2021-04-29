import { Silence, SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { Button, Field, FieldSet, Input, TextArea } from '@grafana/ui';
import MatchersField from './MatchersField';
import { useForm, FormContext } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';
import { useDispatch } from 'react-redux';
import { createSilence } from '../../state/actions';
import { pickBy } from 'lodash';

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
    <FormContext {...formAPI}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldSet label="Edit silence">
          <Input ref={register()} name="id" readOnly />
          <Field label="Starts at">
            <Input ref={register()} name="startsAt" type="datetime-local" />
          </Field>
          <Field label="Ends at">
            <Input ref={register()} name="endsAt" type="datetime-local" />
          </Field>
          <Field label="Duration">
            <Input ref={register()} name="duration" readOnly />
          </Field>
          <MatchersField />
          <Field label="Comment" required>
            <TextArea ref={register({ required: true })} name="comment" />
          </Field>
          <Field label="Created by" required>
            <Input ref={register({ required: true })} name="createdBy" />
          </Field>
        </FieldSet>
        <Button type="submit">Submit</Button>
      </form>
    </FormContext>
  );
};

export default SilencesEditor;
