import { useState, useCallback, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, reportInteraction } from '@grafana/runtime';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Box, Button, Field, Input, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { RepositoryView, Job, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { collectSelectedItems } from 'app/features/browse-dashboards/components/utils';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { StepStatusInfo } from '../../Wizard/types';
import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';
import { StatusInfo } from '../../types';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';
import { getDefaultWorkflow, getWorkflowOptions } from '../defaults';
import { generateTimestamp } from '../utils/timestamp';

import { ExportJobSpec, useBulkActionJob } from './useBulkActionJob';
import { BulkActionFormData, BulkActionProvisionResourceProps } from './utils';

interface FormProps extends BulkActionProvisionResourceProps {
  initialValues: BulkActionFormData;
  workflowOptions: Array<{ label: string; value: string }>;
}

function FormContent({ initialValues, selectedItems, workflowOptions, onDismiss }: FormProps) {
  const styles = useStyles2(getPathPrefixStyles);
  // States
  const [job, setJob] = useState<Job>();
  const [jobError, setJobError] = useState<string | StatusInfo>();
  const [selectedRepositoryName, setSelectedRepositoryName] = useState<string>('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Hooks
  const { createBulkJob, isLoading: isCreatingJob } = useBulkActionJob();
  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const {
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = methods;
  const workflow = watch('workflow');

  // Get repositories list from frontend settings (which returns RepositoryView[])
  const { data: settingsData, isLoading: isLoadingRepos } = useGetFrontendSettingsQuery();
  const repositories = settingsData?.items ?? [];

  // Auto-select first repository when repositories are loaded
  useEffect(() => {
    if (repositories.length > 0 && !selectedRepositoryName && !isLoadingRepos) {
      setSelectedRepositoryName(repositories[0].name || '');
    }
  }, [repositories, selectedRepositoryName, isLoadingRepos]);

  // Get selected repository
  const repositoryView: RepositoryView | undefined = repositories.find(
    (repo) => repo.name === selectedRepositoryName
  );

  // Compute workflow options based on selected repository
  const selectedWorkflowOptions = repositoryView ? getWorkflowOptions(repositoryView) : workflowOptions;
  const selectedDefaultWorkflow = repositoryView
    ? getDefaultWorkflow(repositoryView)
    : (workflowOptions[0]?.value === 'branch' || workflowOptions[0]?.value === 'write'
        ? workflowOptions[0].value
        : undefined);

  // Update workflow, branch, and path when repository changes
  useEffect(() => {
    if (repositoryView && selectedDefaultWorkflow) {
      methods.setValue('workflow', selectedDefaultWorkflow as 'branch' | 'write');
      if (selectedDefaultWorkflow === 'branch') {
        const timestamp = generateTimestamp();
        methods.setValue('ref', `bulk-export/${timestamp}`);
      } else if (selectedDefaultWorkflow === 'write' && repositoryView.branch) {
        methods.setValue('ref', repositoryView.branch);
      }
      // Clear the path when repository changes - user will enter sub-path only
      methods.setValue('path', '');
    }
  }, [repositoryView, selectedDefaultWorkflow, methods]);

  const handleSubmitForm = async (data: BulkActionFormData) => {
    setHasSubmitted(true);

    if (!selectedRepositoryName || !repositoryView) {
      // Use a form-level error since 'repository' is not in BulkActionFormData
      setError('root', {
        type: 'manual',
        message: t('browse-dashboards.bulk-export-resources-form.error-no-repository', 'Please select a repository'),
      });
      setHasSubmitted(false);
      return;
    }

    const resources = collectSelectedItems(selectedItems);
    // Filter out folders - only dashboards are supported for export
    const dashboardResources = resources.filter((r) => r.kind === 'Dashboard');

    if (dashboardResources.length === 0) {
      setError('root', {
        type: 'manual',
        message: t(
          'browse-dashboards.bulk-export-resources-form.error-no-dashboards',
          'No dashboards selected. Only dashboards can be exported.'
        ),
      });
      setHasSubmitted(false);
      return;
    }

    reportInteraction('grafana_provisioning_bulk_export_submitted', {
      workflow: data.workflow,
      repositoryName: repositoryView.name ?? 'unknown',
      repositoryType: repositoryView.type ?? 'unknown',
      resourceCount: dashboardResources.length,
    });

    // Create the export job spec (backend uses 'push' action)
    // Combine repository path with user's sub-path
    const repoPath = repositoryView.path || '';
    const subPath = (data.path || '').trim();
    const exportPath = subPath ? `${repoPath}${repoPath.endsWith('/') ? '' : '/'}${subPath}` : repoPath || undefined;
    const jobSpec: ExportJobSpec = {
      action: 'push',
      push: {
        message: data.comment || undefined,
        branch: data.workflow === 'write' ? undefined : data.ref,
        path: exportPath,
        resources: dashboardResources,
      },
    };

    const result = await createBulkJob(repositoryView, jobSpec);

    if (result.success && result.job) {
      setJob(result.job); // Store the job for tracking
    } else if (!result.success && result.error) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('browse-dashboards.bulk-export-resources-form.error-exporting-resources', 'Error exporting resources'),
          result.error,
        ],
      });
      setHasSubmitted(false);
    }
  };

  const onStatusChange = useCallback((statusInfo: StepStatusInfo) => {
    if (statusInfo.status === 'error' && statusInfo.error) {
      setJobError(statusInfo.error);
    }
  }, []);

  const repositoryOptions = repositories.map((repo) => ({
    label: repo.title || repo.name || '',
    value: repo.name || '',
  }));

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleSubmitForm)}>
        <Stack direction="column" gap={2}>
          {hasSubmitted && job ? (
            <>
              <ProvisioningAlert error={jobError} />
              <JobStatus watch={job} jobType="push" onStatusChange={onStatusChange} />
            </>
          ) : (
            <>
              <Box paddingBottom={2}>
                <Trans i18nKey="browse-dashboards.bulk-export-resources-form.export-total">
                  In total, this will export:
                </Trans>
                <Text element="p" color="secondary">
                  {(() => {
                    // For export, only count explicitly selected dashboards (folders are filtered out)
                    const selectedDashboardUIDs = Object.keys(selectedItems.dashboard || {}).filter(
                      (uid) => selectedItems.dashboard[uid]
                    );
                    const selectedFolderUIDs = Object.keys(selectedItems.folder || {}).filter(
                      (uid) => selectedItems.folder[uid]
                    );
                    const totalItems = selectedDashboardUIDs.length + selectedFolderUIDs.length;
                    if (totalItems === 0) {
                      return t('browse-dashboards.bulk-export-resources-form.no-items', 'No items selected');
                    }
                    const parts: string[] = [];
                    if (selectedFolderUIDs.length > 0) {
                      parts.push(
                        t('browse-dashboards.bulk-export-resources-form.folders-count', '{{count}} folder', {
                          count: selectedFolderUIDs.length,
                        })
                      );
                    }
                    if (selectedDashboardUIDs.length > 0) {
                      parts.push(
                        t('browse-dashboards.bulk-export-resources-form.dashboards-count', '{{count}} dashboard', {
                          count: selectedDashboardUIDs.length,
                        })
                      );
                    }
                    return `${totalItems} ${totalItems === 1 ? 'item' : 'items'}: ${parts.join(', ')}`;
                  })()}
                </Text>
              </Box>

              {/* Show form-level errors */}
              {errors.root && (
                <Alert severity="error" title={String(errors.root.message)} />
              )}

              {/* Info if folders are selected */}
              {Object.keys(selectedItems.folder || {}).filter((uid) => selectedItems.folder[uid]).length > 0 && (
                <Alert severity="info" title={t('browse-dashboards.bulk-export-resources-form.folders-info', 'Folders in selection')}>
                  {t(
                    'browse-dashboards.bulk-export-resources-form.folders-info-description',
                    'Folders will be left behind. New folders will be created in the repository based on the dashboard folder structure.'
                  )}
                </Alert>
              )}

              {/* Repository selection */}
              <Field
                noMargin
                label={t('browse-dashboards.bulk-export-resources-form.repository', 'Repository')}
                error={errors.root?.message}
                invalid={!!errors.root && !selectedRepositoryName}
                required
              >
                <Select
                  options={repositoryOptions}
                  value={selectedRepositoryName}
                  onChange={(option) => {
                    setSelectedRepositoryName(option?.value || '');
                    clearErrors('root');
                  }}
                  isLoading={isLoadingRepos}
                  placeholder={t(
                    'browse-dashboards.bulk-export-resources-form.repository-placeholder',
                    'Select a repository'
                  )}
                />
              </Field>

              {/* Path field */}
              {repositoryView?.path && (
                <Field
                  noMargin
                  label={t('browse-dashboards.bulk-export-resources-form.path', 'Path')}
                  description={t(
                    'browse-dashboards.bulk-export-resources-form.path-description-with-repo',
                    'Add a sub-path below to organize exported dashboards.'
                  )}
                >
                  <Stack direction="row" gap={0} alignItems="stretch">
                    <Box className={styles.pathPrefix}>
                      <Text variant="body" color="secondary">
                        {repositoryView.path}
                      </Text>
                    </Box>
                    <Input
                      type="text"
                      {...methods.register('path')}
                      placeholder={t(
                        'browse-dashboards.bulk-export-resources-form.path-placeholder-with-repo',
                        'e.g., dashboards/team-a/'
                      )}
                      style={{
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        flex: 1,
                      }}
                    />
                  </Stack>
                </Field>
              )}
              {!repositoryView?.path && (
                <Field
                  noMargin
                  label={t('browse-dashboards.bulk-export-resources-form.path', 'Path')}
                  description={t(
                    'browse-dashboards.bulk-export-resources-form.path-description',
                    'Path relative to the repository root (optional). Resources will be exported under this path.'
                  )}
                >
                  <Input
                    type="text"
                    {...methods.register('path')}
                    placeholder={t('browse-dashboards.bulk-export-resources-form.path-placeholder', 'e.g., dashboards/')}
                  />
                </Field>
              )}

              {/* Shared fields (comment, workflow, branch) */}
              {repositoryView && (
                <ResourceEditFormSharedFields
                  resourceType="dashboard"
                  isNew={false}
                  workflow={workflow}
                  workflowOptions={selectedWorkflowOptions}
                  repository={repositoryView}
                  hidePath
                />
              )}

              <Stack gap={2}>
                <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={isCreatingJob}>
                  <Trans i18nKey="browse-dashboards.bulk-export-resources-form.button-cancel">Cancel</Trans>
                </Button>
                <Button
                  type="submit"
                  disabled={!!job || isCreatingJob || hasSubmitted || !selectedRepositoryName}
                >
                  {isCreatingJob
                    ? t('browse-dashboards.bulk-export-resources-form.button-exporting', 'Exporting...')
                    : t('browse-dashboards.bulk-export-resources-form.button-export', 'Export')}
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </form>
    </FormProvider>
  );
}

export function BulkExportProvisionedResource({
  folderUid,
  selectedItems,
  onDismiss,
}: BulkActionProvisionResourceProps) {
  // Check if we're on the root browser dashboards page
  const isRootPage = !folderUid || folderUid === GENERAL_FOLDER_UID;
  const { selectedItemsRepoUID } = useSelectionRepoValidation(selectedItems);
  const { repository } = useGetResourceRepositoryView({
    folderName: isRootPage ? selectedItemsRepoUID : folderUid,
  });

  const workflowOptions = getWorkflowOptions(repository);
  const timestamp = generateTimestamp();
  const defaultWorkflow = getDefaultWorkflow(repository);

  const initialValues = {
    comment: '',
    ref: defaultWorkflow === 'branch' ? `bulk-export/${timestamp}` : (repository?.branch ?? ''),
    workflow: defaultWorkflow,
    path: '',
  };

  // Note: We don't require a repository context for export since user selects target repository
  return (
    <FormContent
      selectedItems={selectedItems}
      onDismiss={onDismiss}
      initialValues={initialValues}
      workflowOptions={workflowOptions}
    />
  );
}

const getPathPrefixStyles = (theme: GrafanaTheme2) => ({
  pathPrefix: css({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.strong}`,
    borderRight: 'none',
    borderTopLeftRadius: theme.shape.borderRadius(1),
    borderBottomLeftRadius: theme.shape.borderRadius(1),
    whiteSpace: 'nowrap',
  }),
});

