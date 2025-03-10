import { Controller, useFormContext } from 'react-hook-form';

import { Field, FieldSet, Input, MultiCombobox, Stack, Switch } from '@grafana/ui';

import { getWorkflowOptions } from '../ConfigForm';
import { ConfigFormGithubCollpase } from '../ConfigFormGithubCollapse';

import { WizardFormData } from './types';

interface FinishStepProps {
  onStatusChange: (success: boolean) => void;
}

export function FinishStep({ onStatusChange }: FinishStepProps) {
  const {
    register,
    watch,
    control,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const type = watch('repository.type');
  const isGithub = type === 'github';

  return (
    <FieldSet label="3. Finish">
      <Stack direction="column">
        <FieldSet label="Automatic pulling">
          <Switch label="Enabled" {...register('repository.sync.enabled')} />
          <Field label={'Interval (seconds)'}>
            <Input
              {...register('repository.sync.intervalSeconds', { valueAsNumber: true })}
              type={'number'}
              placeholder={'60'}
            />
          </Field>
        </FieldSet>
        <FieldSet label="Collaboration Settings">
          <Field
            label={'Workflows'}
            required
            error={errors.repository?.workflows?.message}
            invalid={!!errors.repository?.workflows}
          >
            <Controller
              name={'repository.workflows'}
              control={control}
              rules={{ required: 'This field is required.' }}
              render={({ field: { ref, onChange, ...field } }) => {
                return (
                  <MultiCombobox
                    options={getWorkflowOptions(type)}
                    placeholder={'Readonly repository'}
                    onChange={(val) => {
                      onChange(val.map((v) => v.value));
                    }}
                    {...field}
                  />
                );
              }}
            />
          </Field>
          {isGithub && (
            <ConfigFormGithubCollpase
              previews={
                <Switch
                  {...register('repository.generateDashboardPreviews')}
                  id={'repository.generateDashboardPreviews'}
                />
              }
            />
          )}
        </FieldSet>
      </Stack>
    </FieldSet>
  );
}
