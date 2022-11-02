import React, { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Button, HorizontalGroup } from '@grafana/ui';

import { Correlation } from '../types';
import { useCorrelations } from '../useCorrelations';

import { CorrelationDetailsFormPart } from './CorrelationDetailsFormPart';
import { EditFormDTO } from './types';

interface Props {
  onUpdated: () => void;
  correlation: Correlation;
  readOnly?: boolean;
}

export const EditCorrelationForm = ({ onUpdated, correlation, readOnly = false }: Props) => {
  const {
    update: { execute, loading, error, value },
  } = useCorrelations();

  const onSubmit = (data: EditFormDTO) => {
    return execute({ ...data, sourceUID: correlation.sourceUID, uid: correlation.uid });
  };

  useEffect(() => {
    if (!error && !loading && value) {
      onUpdated();
    }
  }, [error, loading, value, onUpdated]);

  const { uid, sourceUID, targetUID, ...otherCorrelation } = correlation;

  const methods = useForm<EditFormDTO>({ defaultValues: otherCorrelation });

  return (
    <FormProvider {...methods}>
      <form onSubmit={readOnly ? (e) => e.preventDefault() : methods.handleSubmit(onSubmit)}>
        <CorrelationDetailsFormPart readOnly={readOnly} correlation={correlation} />

        {!readOnly && (
          <HorizontalGroup justify="flex-end">
            <Button variant="primary" icon={loading ? 'fa fa-spinner' : 'save'} type="submit" disabled={loading}>
              Save
            </Button>
          </HorizontalGroup>
        )}
      </form>
    </FormProvider>
  );
};
