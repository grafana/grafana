import { Silence } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { Field, FieldSet, Input, TextArea } from '@grafana/ui';
import MatchersField from './MatchersField';
import { useForm, FormContext } from 'react-hook-form';

interface Props {
  silence?: Silence;
}

const getDefaultFormValues = (silence?: Silence) => {
  if (silence) {
    const duration = Date.parse(silence.endsAt) - Date.parse(silence.startsAt);
    return {
      comment: silence.comment,
      createdBy: silence.createdBy,
      startsAndEndsAt: `${silence.startsAt} - ${silence.endsAt}`,
      duration: `${duration} ms`,
      matchers: silence.matchers,
    };
  } else {
    return {
      startsAndEndsAt: '',
      createdBy: '',
      duration: '',
      matchers: [],
      comment: '',
    };
  }
};
export const SilencesEditor: FC<Props> = ({ silence }) => {
  const formAPI = useForm({ defaultValues: getDefaultFormValues(silence) });

  const { register } = formAPI;
  return (
    <FormContext {...formAPI}>
      <form onSubmit={() => {}}>
        <FieldSet label="Edit silence">
          <Field label="Silence start and end">
            <Input ref={register()} name="startsAndEndsAt" />
          </Field>
          <Field label="Duration">
            <Input ref={register()} name="duration" readOnly />
          </Field>
          <MatchersField />
          <Field label="Comment">
            <TextArea ref={register({ required: true })} name="comment" />
          </Field>
          <Field label="Created by">
            <Input ref={register({ required: true })} name="createdBy" />
          </Field>
        </FieldSet>
      </form>
    </FormContext>
  );
};

export default SilencesEditor;
