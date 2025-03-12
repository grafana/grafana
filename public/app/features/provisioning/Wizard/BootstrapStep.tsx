import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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

import { useGetFrontendSettingsQuery, useGetRepositoryFilesQuery, useGetResourceStatsQuery } from '../api';
import { StepStatus } from '../hooks/useStepStatus';
import { checkSyncSettings } from '../utils';

import { WizardFormData } from './types';

type Target = 'instance' | 'folder';
type Operation = 'pull' | 'migrate';

interface Props {
  onOptionSelect: (requiresMigration: boolean) => void;
  onStepUpdate: (status: StepStatus, error?: string) => void;
}

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

interface OptionState {
  isDisabled: boolean;
  disabledReason?: string;
}

export function BootstrapStep({ onOptionSelect, onStepUpdate }: Props) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const settingsQuery = useGetFrontendSettingsQuery();
  const resourceStats = useGetResourceStatsQuery();
  const currentRepoName = watch('repositoryName');
  const selectedTarget = watch('repository.sync.target');
  const [selectedOption, setSelectedOption] = useState<ModeOption | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Get repository files count
  const { data: filesData, isLoading: isLoadingFiles } = useGetRepositoryFilesQuery(
    { name: currentRepoName || '' },
    { skip: !currentRepoName }
  );

  const fileCount = filesData?.items?.length || 0;

  // showing the counts seems more intresting
  const resourceCount = useMemo(() => {
    let count = 0;
    if (!resourceStats.data?.instance) {
      return count;
    }
    for (const x of resourceStats.data.instance) {
      count += x.count;
    }
    return count;
  }, [resourceStats.data]);

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
      if (option.value === 'instance' && option.operation === 'pull' && resourceCount > 0) {
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
    [settingsQuery.data?.legacyStorage, resourceCount, fileCount, otherInstanceConnected, otherFolderConnected]
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

      // Select the new option and update form state
      setSelectedOption(option);
      setValue('repository.sync.target', option.value);
      onOptionSelect(option.operation === 'migrate');
    },
    [setValue, onOptionSelect, getOptionState]
  );

  const isLoading = settingsQuery.isLoading || resourceStats.isLoading || isLoadingFiles;
  const hasAllData = Boolean(settingsQuery.data) && resourceStats.data && (!currentRepoName || filesData !== undefined);

  // Store initialization function in a ref to avoid dependency issues
  const initializeRef = useRef((options: typeof sortedModeOptions) => {
    const firstAvailableOption = options.find((option) => !getOptionState(option).isDisabled);
    if (firstAvailableOption) {
      // Set form state first
      setValue('repository.sync.target', firstAvailableOption.value);

      // Small delay to ensure form state is set
      setTimeout(() => {
        setSelectedOption(firstAvailableOption);
        onOptionSelect(firstAvailableOption.operation === 'migrate');
        setHasInitialized(true);
      }, 0);
    } else {
      setHasInitialized(true); // Mark as initialized even if no options available
    }
  });

  // Initialize form with first available option
  useEffect(() => {
    if (!isLoading && hasAllData && !hasInitialized && sortedModeOptions.length > 0) {
      initializeRef.current(sortedModeOptions);
    }
  }, [isLoading, hasAllData, hasInitialized, sortedModeOptions]);

  // Set migration options when operation changes
  useEffect(() => {
    if (selectedOption?.operation === 'migrate') {
      setValue('migrate.history', true);
      setValue('migrate.identifier', true);
    }
  }, [selectedOption?.operation, setValue]);

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
                <Text variant="h3">{resourceCount} resources</Text>
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
          defaultValue={undefined}
          render={({ field }) => (
            <>
              {sortedModeOptions.map((option, index) => {
                const optionState = getOptionState(option);
                const isSelected = option.value === field.value && selectedOption?.operation === option.operation;

                return optionState.isDisabled ? (
                  <Box key={`${option.value}-${option.operation}`} paddingLeft={2} paddingRight={2}>
                    <Tooltip content={optionState.disabledReason || ''} placement="top">
                      <div style={{ pointerEvents: 'auto' }}>
                        <div style={{ pointerEvents: 'none' }}>
                          <Card disabled={true} tabIndex={-1}>
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
                    onClick={() => {
                      field.onChange(option.value);
                      handleOptionSelect(option);
                    }}
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
