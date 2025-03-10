import { useEffect, useState, useMemo, useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Box, Field, Input, Stack, FieldSet, Card, Alert, Text, LoadingPlaceholder } from '@grafana/ui';

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
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

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
      setIsLoadingCounts(true);
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
      } finally {
        setIsLoadingCounts(false);
      }
    };

    fetchCounts();
  }, []);

  // Get available options and disabled state logic
  const availableOptions = useMemo(() => {
    const isOptionDisabled = (option: ModeOption) => {
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

      if (option.value === 'instance' && (otherInstanceConnected || otherFolderConnected)) {
        return true;
      }

      return false;
    };

    return modeOptions.filter((option) => !isOptionDisabled(option));
  }, [settingsQuery, dashboardCount, folderCount, fileCount, otherInstanceConnected, otherFolderConnected]);

  const handleOptionSelect = useCallback(
    (option: ModeOption) => {
      // If clicking the same option, do nothing (no deselection allowed)
      if (selectedOption?.value === option.value && selectedOption?.operation === option.operation) {
        return;
      }

      // Select the new option
      setSelectedOption(option);
      setValue('repository.sync.target', option.value);
      onOptionSelect(option.operation === 'migrate');
    },
    [selectedOption, setValue, onOptionSelect]
  );

  // Select first available option by default
  useEffect(() => {
    if (!isLoadingCounts && !selectedOption && availableOptions.length > 0) {
      handleOptionSelect(availableOptions[0]);
    }
  }, [availableOptions, isLoadingCounts, selectedOption, handleOptionSelect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for target changes and update title accordingly
  useEffect(() => {
    if (selectedTarget === 'instance') {
      const timestamp = Date.now();
      setValue('repository.title', `instance-${timestamp}`);
    } else if (selectedTarget === 'folder') {
      setValue('repository.title', '');
    }
  }, [selectedTarget, setValue]);

  const isLoading = settingsQuery.isLoading || isLoadingCounts;

  return (
    <FieldSet label="2. Bootstrap your repository">
      <Stack direction="column" gap={2}>
        <Stack direction="column" gap={2}>
          {isLoading ? (
            <Box padding={4}>
              <LoadingPlaceholder text="Loading repository settings..." />
            </Box>
          ) : (
            <>
              {otherFolderConnected && (
                <Alert severity="info" title="Connect your entire Grafana instance is disabled">
                  Instance-wide connection is disabled because you have folders connected to repositories. You must
                  disconnect all folder repositories to use it.
                </Alert>
              )}
              {otherInstanceConnected && (
                <Alert severity="info" title="Connect your entire Grafana instance is disabled">
                  Instance-wide connection is disabled because you have another instance connected to this repository.
                  You must disconnect the other instance to use it.
                </Alert>
              )}
              {settingsQuery.data?.legacyStorage && (
                <Alert severity="info" title="Pull from Repository to Instance is disabled">
                  Pulling from repository to instance is not supported when using legacy storage. Please migrate to
                  unified storage to use this feature.
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
              <Box alignItems="center" padding={4}>
                <Stack direction="row" gap={4} alignItems="flex-start" justifyContent="center">
                  <Stack direction="column" gap={1} alignItems="center">
                    <Text variant="h4" color="secondary">
                      Grafana
                    </Text>
                    <Stack direction="row" gap={2}>
                      <Text variant="h3">{dashboardCount} dashboards</Text>
                      <Text variant="h3">{folderCount} folders</Text>
                    </Stack>
                  </Stack>
                  <Stack direction="column" gap={1} alignItems="center">
                    <Text variant="h4" color="secondary">
                      Repository
                    </Text>
                    <Text variant="h3">{fileCount} files</Text>
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
            </>
          )}
        </Stack>
      </Stack>
    </FieldSet>
  );
}
