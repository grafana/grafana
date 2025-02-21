import { useFormContext } from 'react-hook-form';

import { Button, Field, FieldSet, Input } from '@grafana/ui';

import { useCreateOrUpdateRepository } from '../hooks';

import { WizardFormData } from './types';

export function SyncStep() {
  const { register, watch, setValue } = useFormContext<WizardFormData>();

  const [submitData, request] = useCreateOrUpdateRepository();
  const repositoryName = watch('repositoryName');

  const handleEnableSync = async () => {
    if (!repositoryName) {
      return;
    }

    setValue('repository.sync.enabled', true);
    const formData = watch('repository');
    await submitData(formData);
  };

  return (
    <FieldSet label="4. Configure repository sync">
      <Field label={'Interval (seconds)'}>
        <Input
          {...register('repository.sync.intervalSeconds', { valueAsNumber: true })}
          type={'number'}
          placeholder={'60'}
        />
      </Field>
      <Field>
        <Button onClick={handleEnableSync} disabled={request.isLoading || !repositoryName}>
          {request.isLoading ? 'Enabling sync...' : 'Enable sync'}
        </Button>
      </Field>
    </FieldSet>
  );
}
