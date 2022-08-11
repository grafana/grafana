import React from 'react';
import { SubmitHandler } from 'react-hook-form';

import { Button, HorizontalGroup } from '@grafana/ui';

import { CorrelationDetailsFormPart } from './CorrelationDetailsFormPart';
import { EditFormDTO } from './types';
import { useCorrelationForm } from './useCorrelationForm';

interface Props {
  onSubmit: SubmitHandler<EditFormDTO>;
  defaultValues: EditFormDTO;
  readOnly?: boolean;
}

export const EditCorrelationForm = ({ onSubmit, defaultValues, readOnly = false }: Props) => {
  const { handleSubmit, register } = useCorrelationForm<EditFormDTO>({ onSubmit, defaultValues });

  return (
    <form onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit}>
      <input type="hidden" {...register('uid')} />
      <input type="hidden" {...register('sourceUID')} />
      <CorrelationDetailsFormPart register={register} readOnly={readOnly} correlation={defaultValues} />

      {!readOnly && (
        <HorizontalGroup disabled={readOnly} justify="flex-end">
          <Button variant="primary" icon="save" type="submit">
            Save
          </Button>
        </HorizontalGroup>
      )}
    </form>
  );
};
