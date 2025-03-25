import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Alert, Field, FieldSet, Input, MultiCombobox, Stack, Switch, Text } from '@grafana/ui';

import { getWorkflowOptions } from '../Config/ConfigForm';
import { checkPublicAccess, checkImageRenderer } from '../GettingStarted/features';
import { GETTING_STARTED_URL } from '../constants';

import { WizardFormData } from './types';

export function FinishStep() {
  const {
    register,
    watch,
    control,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const type = watch('repository.type');
  const isGithub = type === 'github';
  const isPublic = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();
  // Enable sync by default
  const { setValue } = useFormContext<WizardFormData>();
  const navigate = useNavigate();

  // Set sync enabled by default
  useEffect(() => {
    setValue('repository.sync.enabled', true);
  }, [setValue]);

  return (
    <Stack direction="column">
      <FieldSet label="Automatic pulling">
        {isGithub && isPublic && (
          <Stack>
            <Alert severity="info" title="Instantenous provisioning available">
              Automatically provision and update your dashboards as soon as changes are pushed to your GitHub
              repository.
            </Alert>
          </Stack>
        )}
        {isGithub && !isPublic && (
          <Alert
            title={'Public URL not configured'}
            severity="info"
            buttonContent={<span>Instructions</span>}
            onRemove={() => navigate(GETTING_STARTED_URL)}
          >
            Changes in git will eventually be pulled depending on the synchronization interval.
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
          <>
            {isPublic ? (
              <Alert severity="info" title="Preview links available">
                Preview links will be automatically added to pull requests when changes are made.
              </Alert>
            ) : (
              <Alert
                severity="info"
                title="Public URL not configured"
                onRemove={() => navigate(GETTING_STARTED_URL)}
                buttonContent={<span>Instructions</span>}
              >
                Preview links in pull requests will not be available until a public URL is configured.
              </Alert>
            )}

            {!hasImageRenderer && (
              <Alert
                severity="info"
                title="Image renderer not configured"
                onRemove={() => navigate(GETTING_STARTED_URL)}
                buttonContent={<span>Instructions</span>}
              >
                The image renderer is not configured. Preview images will not be available.
              </Alert>
            )}

            {hasImageRenderer && isPublic && (
              <>
                <Field
                  label={'Attach dashboard previews to pull requests'}
                  description={
                    <Text element="span">Render before/after images and link them to the pull request.</Text>
                  }
                >
                  <Switch
                    {...register('repository.generateDashboardPreviews')}
                    id={'repository.generateDashboardPreviews'}
                  />
                </Field>
                <Alert severity="info" title="Note">
                  This will render dashboards into an image that can be access by a public URL
                </Alert>
              </>
            )}
          </>
        )}
      </FieldSet>
    </Stack>
  );
}
