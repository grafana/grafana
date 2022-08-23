import React, { useCallback } from 'react';

import { Button, HorizontalGroup } from '@grafana/ui';

import { useCorrelations } from '../useCorrelations';

import { CorrelationDetailsFormPart } from './CorrelationDetailsFormPart';
import { EditFormDTO } from './types';
import { useCorrelationForm } from './useCorrelationForm';

interface Props {
  onUpdated: () => void;
  defaultValues: EditFormDTO;
  readOnly?: boolean;
}

export const EditCorrelationForm = ({ onUpdated, defaultValues, readOnly = false }: Props) => {
  const { update } = useCorrelations();

  const onSubmit = useCallback(
    async (correlation) => {
      await update.execute(correlation);
      onUpdated();
    },
    [update, onUpdated]
  );

  const { handleSubmit, register } = useCorrelationForm<EditFormDTO>({ onSubmit, defaultValues });

  return (
    <form onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit}>
      <input type="hidden" {...register('uid')} />
      <input type="hidden" {...register('sourceUID')} />
      <CorrelationDetailsFormPart register={register} readOnly={readOnly} correlation={defaultValues} />

      {!readOnly && (
        <HorizontalGroup justify="flex-end">
          <Button
            variant="primary"
            icon={update.loading ? 'fa fa-spinner' : 'save'}
            type="submit"
            disabled={update.loading}
          >
            Save
          </Button>
        </HorizontalGroup>
      )}
    </form>
  );
};
