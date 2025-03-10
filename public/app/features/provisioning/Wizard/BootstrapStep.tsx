import { useEffect, useState, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Box, Field, Input, Stack, FieldSet, Card, Alert, Text } from '@grafana/ui';

import { useGetFrontendSettingsQuery, useGetRepositoryFilesQuery } from '../api';
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
  const currentRepoName = watch('repositoryName');
  const selectedTarget = watch('repository.sync.target');
  const [selectedOption, setSelectedOption] = useState<ModeOption | null>(null);
  const [dashboardCount, setDashboardCount] = useState<number>(0);
  const [folderCount, setFolderCount] = useState<number>(0);
  const [fileCount, setFileCount] = useState<number>(0);

  // Get repository files count
  const { data: filesData } = useGetRepositoryFilesQuery({ name: currentRepoName || '' }, { skip: !currentRepoName });

  useEffect(() => {
    if (filesData?.items) {
      setFileCount(filesData.items.length);
    }
  }, [filesData]);

  // Check for other repositories excluding the current one
  const [otherInstanceConnected, otherFolderConnected] = useMemo(() => {
    if (!settingsQuery.data) {
      return [false, false];
    }

    const repositories = settingsQuery.data.items || [];
    // Filter out the current repository if it exists
    const otherRepos = repositories.filter((repo) => {
      return repo.name !== currentRepoName;
    });

    return checkSyncSettings({ ...settingsQuery.data, items: otherRepos });
  }, [settingsQuery.data, currentRepoName]);

  // Fetch dashboard and folder counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // TODO: How to do this in the right way?
        // Get dashboard count using v0alpha1 API
        const dashboardResponse = await fetch(
          '/apis/dashboard.grafana.app/v0alpha1/namespaces/default/search?query=*&limit=0&type=dashboard'
        );
        const dashboardData = await dashboardResponse.json();
        setDashboardCount(dashboardData.totalHits || 0);

        // Get folder count using v0alpha1 API
        const folderResponse = await fetch(
          '/apis/dashboard.grafana.app/v0alpha1/namespaces/default/search?query=*&limit=0&type=folder'
        );
        const folderData = await folderResponse.json();
        setFolderCount(folderData.totalHits || 0);
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };

    fetchCounts();
  }, []);

  const isOptionDisabled = (option: ModeOption) => {
    // If this is the selected option, it's not disabled
    if (selectedOption?.value === option.value && selectedOption?.operation === option.operation) {
      return false;
    }
    // Disable pull instance option if using legacy storage
    if (option.value === 'instance' && option.operation === 'pull' && settingsQuery.data?.legacyStorage) {
      return true;
    }
    // Disable pull instance option if there are existing dashboards or folders
    if (option.value === 'instance' && option.operation === 'pull' && (dashboardCount > 0 || folderCount > 0)) {
      return true;
    }

    // Disable migrate option if there are existing files
    if (option.operation === 'migrate' && fileCount > 0) {
      return true;
    }
    // Otherwise, check if there's another connection of the same type
    return (
      (option.value === 'instance' && otherInstanceConnected) || (option.value === 'folder' && otherFolderConnected)
    );
  };

  // Get available options
  const availableOptions = useMemo(() => {
    return modeOptions.filter((option) => !isOptionDisabled(option));
  }, [
    dashboardCount,
    folderCount,
    fileCount,
    otherInstanceConnected,
    otherFolderConnected,
    settingsQuery.data?.legacyStorage,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Select first available option by default
  useEffect(() => {
    if (!selectedOption && availableOptions.length > 0) {
      handleOptionSelect(availableOptions[0]);
    }
  }, [availableOptions]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {otherFolderConnected && (
            <Alert severity="info" title="Connect your entire Grafana instance is disabled">
              Instance-wide connection is disabled because you have folders connected to repositories. You must
              disconnect all folder repositories to use it.
            </Alert>
          )}
          {otherInstanceConnected && (
            <Alert severity="info" title="Connect your entire Grafana instance is disabled">
              Instance-wide connection is disabled because you have another instance connected to this repository. You
              must disconnect the other instance to use it.
            </Alert>
          )}
          {settingsQuery.data?.legacyStorage && (
            <Alert severity="info" title="Pull from Repository to Instance is disabled">
              Pulling from repository to instance is not supported when using legacy storage. Please migrate to unified
              storage to use this feature.
            </Alert>
          )}
          {dashboardCount > 0 ||
            (folderCount > 0 && (
              <Alert severity="info" title="Pull from Repository to Instance is disabled">
                <Stack direction="column" gap={1}>
                  <Text>Pulling from repository to instance is disabled because you have existing resources:</Text>
                  <Text>Please migrate your existing resources to the repository first.</Text>
                </Stack>
              </Alert>
            ))}
          {fileCount > 0 && (
            <Alert severity="info" title="Migrate to Repository is disabled">
              Migrating to repository is disabled because you have existing files in the repository. You must delete
              your existing files before migrating.
            </Alert>
          )}
          <Box alignItems="center">
            <Stack direction="row" gap={4} alignItems="flex-start" justifyContent="center">
              <Stack direction="column" gap={1} alignItems="center">
                <Text variant="bodySmall" color="secondary">
                  Grafana
                </Text>
                <Stack direction="row" gap={2}>
                  <Text>{dashboardCount} dashboards</Text>
                  <Text>{folderCount} folders</Text>
                </Stack>
              </Stack>
              <Stack direction="column" gap={1} alignItems="center">
                <Text variant="bodySmall" color="secondary">
                  Repository
                </Text>
                <Text>{fileCount} files</Text>
              </Stack>
            </Stack>
          </Box>

          <Controller
            name="repository.sync.target"
            control={control}
            render={({ field: { value } }) => (
              <>
                {availableOptions.map((option) => (
                  <Card
                    key={`${option.value}-${option.operation}`}
                    isSelected={
                      selectedOption?.value === option.value && selectedOption?.operation === option.operation
                    }
                    onClick={() => handleOptionSelect(option)}
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
