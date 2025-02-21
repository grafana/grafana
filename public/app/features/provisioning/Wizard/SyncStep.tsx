import { useFormContext } from 'react-hook-form';

import { Alert, Button, Field, FieldSet, Input, Stack } from '@grafana/ui';

import { useCreateOrUpdateRepository } from '../hooks';
import { dataToSpec } from '../utils/data';

import { RequestErrorAlert } from './RequestErrorAlert';
import { WizardFormData } from './types';

interface SyncStepProps {
  onSyncSuccess: () => void;
}

export function SyncStep({ onSyncSuccess }: SyncStepProps) {
  const { register, watch, getValues } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const [submitData, request] = useCreateOrUpdateRepository();

  const handleEnableSync = async () => {
    if (!repositoryName) {
      return;
    }

    try {
      const formData = getValues('repository');
      await submitData(
        dataToSpec({
          ...formData,
          sync: {
            ...formData.sync,
            enabled: true,
          },
        })
      );
      onSyncSuccess();
    } catch {
      // Error will be shown via RequestErrorAlert
    }
  };

  return (
    <FieldSet label="4. Configure repository sync">
      <Stack direction="column" gap={2}>
        {!repositoryName && (
          <Alert severity="error" title="Repository name required">
            Repository name is required to enable sync. Please complete the repository configuration step first.
          </Alert>
        )}
        <RequestErrorAlert request={request} />
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
      </Stack>
    </FieldSet>
  );
}
