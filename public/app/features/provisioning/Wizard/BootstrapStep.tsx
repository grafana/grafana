import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Field, Input, Stack, FieldSet, Card, Alert } from '@grafana/ui';

import { useGetFrontendSettingsQuery } from '../api';
import { checkSyncSettings } from '../utils';

import { WizardFormData } from './types';

type Target = 'instance' | 'folder';
type Operation = 'pull' | 'migrate';

interface ModeOption {
  value: Target;
  operation: Operation;
  label: string;
  description: string;
}

const modeOptions: ModeOption[] = [
  {
    value: 'instance',
    operation: 'migrate',
    label: 'Migrate Instance to Repository',
    description: 'Save all Grafana resources to repository',
  },
  {
    value: 'instance',
    operation: 'pull',
    label: 'Pull from Repository to Instance',
    description: 'Pull resources from repository into this Grafana instance',
  },
  {
    value: 'folder',
    operation: 'pull',
    label: 'Pull from Repository to Folder',
    description: 'Pull repository resources into a specific folder',
  },
];

type Props = {
  onOptionSelect: (requiresMigration: boolean) => void;
};

export function BootstrapStep({ onOptionSelect }: Props) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const settingsQuery = useGetFrontendSettingsQuery();
  const [instanceConnected, folderConnected] = checkSyncSettings(settingsQuery.data);
  const selectedTarget = watch('repository.sync.target');
  const [selectedOption, setSelectedOption] = useState<ModeOption | null>(null);

  const isOptionDisabled = (option: ModeOption) => {
    // If this is the selected option, it's not disabled
    if (selectedOption?.value === option.value && selectedOption?.operation === option.operation) {
      return false;
    }
    // Otherwise, check if there's a connection of the same type
    return (option.value === 'instance' && instanceConnected) || (option.value === 'folder' && folderConnected);
  };

  // Select first available option by default
  useEffect(() => {
    if (!selectedOption) {
      // Find first option that doesn't have a connection of its type
      const firstAvailableOption = modeOptions.find((option) => {
        if (option.value === 'instance') {
          return !instanceConnected;
        }
        if (option.value === 'folder') {
          return !folderConnected;
        }
        return true;
      });

      if (firstAvailableOption) {
        handleOptionSelect(firstAvailableOption);
      }
    }
  }, [instanceConnected, folderConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for target changes and update title accordingly
  useEffect(() => {
    if (selectedTarget === 'instance') {
      const timestamp = Date.now();
      setValue('repository.title', `instance-${timestamp}`);
    } else if (selectedTarget === 'folder') {
      setValue('repository.title', '');
    }
  }, [selectedTarget, setValue]);

  const handleOptionSelect = (option: ModeOption) => {
    // If clicking the same option, do nothing (no deselection allowed)
    if (selectedOption?.value === option.value && selectedOption?.operation === option.operation) {
      return;
    }

    // Select the new option
    setSelectedOption(option);
    setValue('repository.sync.target', option.value);
    onOptionSelect(option.operation === 'migrate');
  };

  return (
    <FieldSet label="2. Bootstrap your repository">
      <Stack direction="column" gap={2}>
        <Stack direction="column" gap={2}>
          {folderConnected && (
            <Alert severity="info" title="Connect your entire Grafana instance is disabled">
              Instance-wide connection is disabled because you have folders connected to repositories. You must
              disconnect all folder repositories to use it.
            </Alert>
          )}
          <Controller
            name="repository.sync.target"
            control={control}
            render={({ field: { value } }) => (
              <>
                {modeOptions.map((option) => (
                  <Card
                    key={`${option.value}-${option.operation}`}
                    isSelected={
                      selectedOption?.value === option.value && selectedOption?.operation === option.operation
                    }
                    onClick={() => handleOptionSelect(option)}
                    disabled={isOptionDisabled(option)}
                  >
                    <Card.Heading>{option.label}</Card.Heading>
                    <Card.Description>{option.description}</Card.Description>
                  </Card>
                ))}
              </>
            )}
          />
          {/* Only show title field if not instance sync */}
          {selectedTarget === 'folder' && (
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
          )}
        </Stack>
      </Stack>
    </FieldSet>
  );
}
