import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import {
  Badge,
  Box,
  Card,
  Field,
  FieldSet,
  Icon,
  Input,
  LoadingPlaceholder,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@grafana/ui';

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
  const [hasLoadedCounts, setHasLoadedCounts] = useState(false);

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
        setHasLoadedCounts(true);
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

  // Add sorted options after getOptionState is defined
  const sortedModeOptions = useMemo(() => {
    return [...modeOptions].sort((a, b) => {
      const stateA = getOptionState(a);
      const stateB = getOptionState(b);
      return stateA.isDisabled === stateB.isDisabled ? 0 : stateA.isDisabled ? 1 : -1;
    });
  }, [getOptionState]);

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

  // Add this after handleOptionSelect
  useEffect(() => {
    // Set default values for migration options when instance migration is selected
    if (selectedOption?.operation === 'migrate') {
      setValue('migrate.history', true);
      setValue('migrate.identifier', true);
    }
  }, [selectedOption, setValue]);

  const isLoading = settingsQuery.isLoading || isLoadingCounts;
  const hasAllData = settingsQuery.data !== undefined && filesData !== undefined && hasLoadedCounts;

  // Select first available option by default
  useEffect(() => {
    // Only try to select when we have all the data needed to make the decision
    const canSelectOption = !isLoading && hasAllData && !selectedOption;

    if (canSelectOption) {
      // Find first enabled option
      const firstAvailableOption = sortedModeOptions.find((option) => {
        const state = getOptionState(option);
        return !state.isDisabled;
      });

      if (firstAvailableOption) {
        handleOptionSelect(firstAvailableOption);
      }
    }
  }, [isLoading, hasAllData, selectedOption, getOptionState, handleOptionSelect, sortedModeOptions]);

  // Watch for target changes and update title accordingly
  useEffect(() => {
    if (selectedTarget === 'instance') {
      const timestamp = Date.now();
      setValue('repository.title', `instance-${timestamp}`);
    } else if (selectedTarget === 'folder') {
      setValue('repository.title', '');
    }
  }, [selectedTarget, setValue]);

  // Show loading state only when we don't have any data yet
  if (isLoading || !hasAllData) {
    return (
      <Box padding={4}>
        <LoadingPlaceholder text="Loading repository settings..." />
      </Box>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={2}>
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
              {sortedModeOptions.map((option, index) => {
                const optionState = getOptionState(option);
                const isSelected =
                  selectedOption?.value === option.value && selectedOption?.operation === option.operation;

                return optionState.isDisabled ? (
                  <Box paddingLeft={2} paddingRight={2}>
                    <Tooltip content={optionState.disabledReason || ''} placement="top">
                      <div style={{ pointerEvents: 'auto' }}>
                        <div style={{ pointerEvents: 'none' }}>
                          <Card key={`${option.value}-${option.operation}`} disabled={true} tabIndex={-1}>
                            <Card.Heading>
                              <Stack direction="row" alignItems="center" gap={2}>
                                <Text color="secondary">{option.label}</Text>
                                <Badge color="blue" text="Not available" icon="info" />
                              </Stack>
                            </Card.Heading>
                            <Card.Description>{option.description}</Card.Description>
                          </Card>
                        </div>
                      </div>
                    </Tooltip>
                  </Box>
                ) : (
                  <Card
                    key={`${option.value}-${option.operation}`}
                    isSelected={isSelected}
                    onClick={() => handleOptionSelect(option)}
                    tabIndex={0}
                    autoFocus={index === 0}
                  >
                    <Card.Heading>
                      <Text color="primary" element="h4">
                        {option.label}
                      </Text>
                    </Card.Heading>
                    <Card.Description>{option.description}</Card.Description>
                  </Card>
                );
              })}
            </>
          )}
        />

        {/* Add migration options */}
        {selectedOption?.operation === 'migrate' && (
          <FieldSet label="Migrate options">
            <Stack direction="column" gap={2}>
              <Stack direction="row" gap={2} alignItems="center">
                <Switch {...register('migrate.identifier')} defaultChecked={true} />
                <Text>Include identifiers</Text>
                <Tooltip content="Include unique identifiers for each dashboard to maintain references" placement="top">
                  <Icon name="info-circle" />
                </Tooltip>
              </Stack>
              <Stack direction="row" gap={2} alignItems="center">
                <Switch {...register('migrate.history')} defaultChecked={true} />
                <Text>Include history</Text>
                <Tooltip content="Include complete dashboard version history" placement="top">
                  <Icon name="info-circle" />
                </Tooltip>
              </Stack>
            </Stack>
          </FieldSet>
        )}

        {/* Only show title field if folder sync */}
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
      </Stack>
    </Stack>
  );
}
