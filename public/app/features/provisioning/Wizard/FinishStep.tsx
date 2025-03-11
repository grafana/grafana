import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Alert, Field, FieldSet, Input, MultiCombobox, Stack, Switch } from '@grafana/ui';

import { getWorkflowOptions } from '../ConfigForm';
import { checkPublicAccess } from '../GettingStarted/features';
import { GETTING_STARTED_URL } from '../constants';

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
  const isPublic = checkPublicAccess();
  // Enable sync by default
  const { setValue } = useFormContext<WizardFormData>();
  const navigate = useNavigate();

  // Set sync enabled by default
  useEffect(() => {
    setValue('repository.sync.enabled', true);
    onStatusChange(true); // Indicate success
  }, [setValue, onStatusChange]);

  return (
    <Stack direction="column">
      {(!isPublic || !isGithub) && (
        <FieldSet label="Automatic pulling">
          {isGithub && (
            <Alert
              title={'Public URL not configured'}
              severity={'warning'}
              buttonContent={<span>Instructions</span>}
              onRemove={() => navigate(GETTING_STARTED_URL)}
            >
              Changes in git will eventually be pulled depending on the synchronization interval. Pull requests will not
              be proccessed
            </Alert>
          )}
          <Field label={'Interval (seconds)'}>
            <Input
              {...register('repository.sync.intervalSeconds', { valueAsNumber: true })}
              type={'number'}
              placeholder={'60'}
            />
          </Field>
        </FieldSet>
      )}
      <FieldSet label="Collaboration">
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
          <Field
            label={'Attach dashboard previews to pull requests'}
            description={
              <span>
                Render before/after images and link them to the pull request.
                <br />
                NOTE! this will render dashboards into an image that can be access by a public URL
              </span>
            }
          >
            <Switch {...register('repository.generateDashboardPreviews')} id={'repository.generateDashboardPreviews'} />
          </Field>
        )}
      </FieldSet>
    </Stack>
  );
}
