import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Alert, Badge, Box, Card, Field, Input, LoadingPlaceholder, Stack, Text, Tooltip, Icon } from '@grafana/ui';

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

interface OptionState {
  isDisabled: boolean;
  disabledReason?: string;
}

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
  const getOptionState = useCallback(
    (option: ModeOption): OptionState => {
      // Disable pull instance option if using legacy storage
      if (option.value === 'instance' && option.operation === 'pull' && settingsQuery.data?.legacyStorage) {
        return {
          isDisabled: true,
          disabledReason:
            'Pulling from repository to instance is not supported when using legacy storage. Please migrate to unified storage.',
        };
      }

      // Disable pull instance option if there are existing dashboards or folders
      if (option.value === 'instance' && option.operation === 'pull' && (dashboardCount > 0 || folderCount > 0)) {
        return {
          isDisabled: true,
          disabledReason:
            'Cannot pull to instance when you have existing resources. Please migrate your existing resources first.',
        };
      }

      // Disable migrate option if there are existing files
      if (option.operation === 'migrate' && fileCount > 0) {
        return {
          isDisabled: true,
          disabledReason: 'Cannot migrate when repository has existing files. Please delete existing files first.',
        };
      }

      if (option.value === 'instance' && otherInstanceConnected) {
        return {
          isDisabled: true,
          disabledReason:
            'Instance-wide connection is disabled because another instance is connected to this repository.',
        };
      }

      if (option.value === 'instance' && otherFolderConnected) {
        return {
          isDisabled: true,
          disabledReason: 'Instance-wide connection is disabled because folders are connected to repositories.',
        };
      }

      return { isDisabled: false };
    },
    [
      settingsQuery.data?.legacyStorage,
      dashboardCount,
      folderCount,
      fileCount,
      otherInstanceConnected,
      otherFolderConnected,
    ]
  );

  const handleOptionSelect = useCallback(
    (option: ModeOption) => {
      const optionState = getOptionState(option);
      if (optionState.isDisabled) {
        return;
      }

      // If clicking the same option, do nothing (no deselection allowed)
      if (selectedOption?.value === option.value && selectedOption?.operation === option.operation) {
        return;
      }

      // Select the new option
      setSelectedOption(option);
      setValue('repository.sync.target', option.value);
      onOptionSelect(option.operation === 'migrate');
    },
    [selectedOption, setValue, onOptionSelect, getOptionState]
  );

  const isLoading = settingsQuery.isLoading || isLoadingCounts;

  // Select first available option by default
  useEffect(() => {
    // Only try to select when we have all the data needed to make the decision
    const canSelectOption =
      !isLoading && settingsQuery.data !== undefined && filesData !== undefined && !selectedOption; // Only try to select if no option is currently selected

    if (canSelectOption) {
      // Find first enabled option
      const firstAvailableOption = modeOptions.find((option) => {
        const state = getOptionState(option);
        return !state.isDisabled;
      });

      if (firstAvailableOption) {
        // Force selection of first available option
        setSelectedOption(firstAvailableOption);
        setValue('repository.sync.target', firstAvailableOption.value);
        onOptionSelect(firstAvailableOption.operation === 'migrate');
      }
    }
  }, [isLoading, settingsQuery.data, filesData, selectedOption, getOptionState, setValue, onOptionSelect]);

  // Watch for target changes and update title accordingly
  useEffect(() => {
    if (selectedTarget === 'instance') {
      const timestamp = Date.now();
      setValue('repository.title', `instance-${timestamp}`);
    } else if (selectedTarget === 'folder') {
      setValue('repository.title', '');
    }
  }, [selectedTarget, setValue]);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={2}>
        {isLoading ? (
          <Box padding={4}>
            <LoadingPlaceholder text="Loading repository settings..." />
          </Box>
        ) : (
          <>
            <Box alignItems="center" padding={4}>
              <Stack direction="row" gap={4} alignItems="flex-start" justifyContent="center">
                <Stack direction="column" gap={1} alignItems="center">
                  <Text variant="h4" color="secondary">
                    Grafana
                  </Text>
                  <Stack direction="row" gap={2}>
                    <Text variant="h3">{dashboardCount + folderCount} resources</Text>
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
                  {modeOptions.map((option, index) => {
                    const optionState = getOptionState(option);
                    const isSelected =
                      selectedOption?.value === option.value && selectedOption?.operation === option.operation;

                    return (
                      <Card
                        key={`${option.value}-${option.operation}`}
                        // Only pass isSelected if the option is enabled
                        {...(!optionState.isDisabled && { isSelected })}
                        onClick={() => !optionState.isDisabled && handleOptionSelect(option)}
                        disabled={optionState.isDisabled}
                        tabIndex={optionState.isDisabled ? -1 : 0}
                        // Auto-focus the first available option
                        autoFocus={index === 0 && !optionState.isDisabled}
                      >
                        <Card.Heading>
                          <Text color={optionState.isDisabled ? 'secondary' : 'primary'}>{option.label}</Text>
                          {optionState.isDisabled && optionState.disabledReason && (
                            <Tooltip content={optionState.disabledReason}>
                              <Badge color="blue" text="Not available" icon="info" />
                            </Tooltip>
                          )}
                        </Card.Heading>
                        <Card.Description>
                          <Stack direction="row" alignItems="center" gap={1}>
                            {option.description}
                          </Stack>
                        </Card.Description>
                      </Card>
                    );
                  })}
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
                  // Auto-focus the title field if it's the only available option
                  autoFocus={modeOptions.length === 1 && modeOptions[0].value === 'folder'}
                />
              </Field>
            )}
          </>
        )}
      </Stack>
    </Stack>
  );
}
