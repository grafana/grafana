import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Field, Input, Combobox, Stack, FieldSet, Card, Alert } from '@grafana/ui';

import { useGetFrontendSettingsQuery } from '../api';
import { checkSyncSettings } from '../utils';

import { WizardFormData } from './types';

const typeOptions = [
  { label: 'GitHub', value: 'github' },
  { label: 'Local', value: 'local' },
];

const modeOptions = [
  {
    value: 'instance',
    label: 'Connect your entire Grafana instance to an external repository',
    description: 'Read all dashboards from an external repository',
  },
  {
    value: 'folder',
    label: 'Connect a single folder to your repository',
    description:
      'Save and manage dashboards from a selected folder while keeping others separate. You can create multiple connections between different folders and repositories.',
  },
];

type Props = {
  targetSelectable?: boolean;
};

export function ConnectionStep({ targetSelectable = true }: Props) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const workflows = watch('repository.workflows');
  const settingsQuery = useGetFrontendSettingsQuery();
  const [instanceConnected, folderConnected] = checkSyncSettings(settingsQuery.data);

  const availableOptions = modeOptions.filter((option) => {
    if (folderConnected) {
      return option.value === 'folder';
    }
    if (instanceConnected) {
      return option.value === 'instance';
    }
    return true;
  });

  useEffect(() => {
    if (folderConnected) {
      setValue('repository.sync.target', folderConnected ? 'folder' : 'instance');
    }
  }, [folderConnected, setValue]);

  return (
    <FieldSet label="1. Set up your repository connection details">
      <Stack direction="column" gap={2}>
        <Field
          label="Repository type"
          description="Choose the type of repository where your dashboards will be stored."
          required
        >
          <Controller
            name="repository.type"
            control={control}
            rules={{ required: true }}
            render={({ field: { ref, onChange, ...field } }) => (
              <Combobox
                {...field}
                options={typeOptions}
                placeholder="Select repository type"
                onChange={(value) => {
                  onChange(value?.value);
                  setValue(
                    'repository.workflows',
                    workflows.filter((workflow) => workflow !== 'branch')
                  );
                }}
              />
            )}
          />
        </Field>
        <Field
          label="Display name"
          description="Add a clear name for this repository connection"
          error={errors.repository?.title?.message}
          invalid={!!errors.repository?.title}
        >
          <Input
            {...register('repository.title', { required: 'This field is required.' })}
            placeholder="My repository connection"
          />
        </Field>

        <Stack direction="column" gap={2}>
          {folderConnected && (
            <Alert severity="info" title="Connect your entire Grafana instance is disabled">
              Instance-wide connection is disabled because you have folders connected to repositories. You must
              disconnect all folder repositories to use it.
            </Alert>
          )}
          {targetSelectable && (
            <Controller
              name="repository.sync.target"
              control={control}
              render={({ field: { onChange, value } }) => (
                <>
                  {availableOptions.map((option) => (
                    <Card
                      key={option.value}
                      isSelected={value === option.value}
                      onClick={() => onChange(option.value)}
                      disabled={folderConnected || instanceConnected}
                    >
                      <Card.Heading>{option.label}</Card.Heading>
                      <Card.Description>{option.description}</Card.Description>
                    </Card>
                  ))}
                </>
              )}
            />
          )}
        </Stack>
      </Stack>
    </FieldSet>
  );
}
