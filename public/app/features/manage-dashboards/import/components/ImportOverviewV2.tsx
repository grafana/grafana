import { useCallback, useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents, locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { ProvisioningAlert } from 'app/features/provisioning/Shared/ProvisioningAlert';
import { RepoInvalidStateBanner } from 'app/features/provisioning/components/Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from 'app/features/provisioning/components/Shared/ResourceEditFormSharedFields';
import {
  getCanPushToConfiguredBranch,
  getDefaultRef,
  getDefaultWorkflow,
} from 'app/features/provisioning/components/defaults';
import { generatePath, slugifyForFilename } from 'app/features/provisioning/components/utils/path';
import { generateTimestamp } from 'app/features/provisioning/components/utils/timestamp';
import {
  useGetResourceRepositoryView,
  RepoViewStatus,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { type DashboardInputs, DashboardSource, type ImportFormDataV2 } from '../../types';
import { useImportProvisionedSave } from '../hooks/useImportProvisionedSave';
import { truncateFloatGridItems } from '../utils/floatingGridItems';
import { applyV2Inputs } from '../utils/inputs';

import { GcomDashboardInfo } from './GcomDashboardInfo';
import { ImportDashboardFormV2 } from './ImportDashboardFormV2';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

type Props = {
  dashboard: DashboardV2Spec;
  dashboardUid?: string;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  folderUid: string;
  onCancel: () => void;
};

export function ImportOverviewV2({ dashboard, dashboardUid, inputs, meta, source, folderUid, onCancel }: Props) {
  const { layout: normalizedLayout, modified: hasFloatGridItems } = useMemo(
    () => truncateFloatGridItems(dashboard.layout),
    [dashboard.layout]
  );

  const methods = useForm<ImportFormDataV2>({
    defaultValues: {
      dashboard: dashboard,
      folderUid: folderUid,
      k8s: {
        ...(dashboardUid !== undefined ? { name: dashboardUid } : {}),
        annotations: { 'grafana.app/folder': folderUid },
      },
    },
    mode: 'onChange',
  });
  const { register, control, watch, getValues, setValue, handleSubmit, trigger, formState } = methods;
  const errors = formState.errors;

  // Trigger initial validation (replicates Form's validateOnMount)
  useEffect(() => {
    trigger();
  }, [trigger]);

  // --- Folder-based provisioning detection ---
  const watchedFolderUid = watch('folderUid');
  const currentFolderUid = typeof watchedFolderUid === 'string' ? watchedFolderUid : '';

  const { repository, status, isReadOnlyRepo } = useGetResourceRepositoryView({
    folderName: currentFolderUid || undefined,
  });

  const isProvisioned = status === RepoViewStatus.Ready && !!repository;
  const isOrphaned = status === RepoViewStatus.Orphaned;
  const isRepoLoading = status === RepoViewStatus.Loading;

  // --- Provisioned defaults ---
  useEffect(() => {
    if (!isProvisioned || !repository) {
      return;
    }
    const workflow = getDefaultWorkflow(repository);
    const ref = getDefaultRef(repository, 'import');
    const dashboardValue = getValues('dashboard');
    const title =
      (dashboardValue && typeof dashboardValue === 'object' && 'title' in dashboardValue
        ? String(dashboardValue.title)
        : '') ||
      dashboard.title ||
      '';
    const slug = slugifyForFilename(title);
    const path = generatePath({
      timestamp: generateTimestamp(),
      slug,
    });

    setValue('workflow', workflow, { shouldDirty: false });
    setValue('ref', ref, { shouldDirty: false });
    setValue('path', path, { shouldDirty: false });
    setValue('repo', repository.name, { shouldDirty: false });
  }, [isProvisioned, repository, setValue, getValues, dashboard.title]);

  // --- Provisioned save hook ---
  const provisionedSave = useProvisionedSaveIfAvailable(repository);

  // --- Standard (non-provisioned) submit ---
  const onStandardSubmit = useCallback(
    async (form: ImportFormDataV2) => {
      reportInteraction(IMPORT_FINISHED_EVENT_NAME);

      try {
        const dashboardToSave: DashboardV2Spec = hasFloatGridItems
          ? { ...dashboard, layout: normalizedLayout }
          : dashboard;

        const dashboardWithDataSources = {
          ...applyV2Inputs(dashboardToSave, form),
          title: form.dashboard.title,
        };

        const api = await getDashboardAPI('v2');
        const result = await api.saveDashboard({
          ...form,
          dashboard: dashboardWithDataSources,
        });

        if (result.url) {
          const dashboardUrl = locationUtil.stripBaseFromUrl(result.url);
          locationService.push(dashboardUrl);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        appEvents.emit(AppEvents.alertError, ['Dashboard import failed', message]);
      }
    },
    [dashboard, hasFloatGridItems, normalizedLayout]
  );

  // --- Mode-aware submit handler ---
  const onSubmit = useCallback(
    (form: ImportFormDataV2) => {
      if (isProvisioned && provisionedSave && !isReadOnlyRepo) {
        reportInteraction(IMPORT_FINISHED_EVENT_NAME, {
          provisioned: true,
          workflow: form.workflow,
        });

        const dashboardToSave: DashboardV2Spec = hasFloatGridItems
          ? { ...dashboard, layout: normalizedLayout }
          : dashboard;

        const dashboardWithDataSources = {
          ...applyV2Inputs(dashboardToSave, form),
          title: form.dashboard.title,
        };

        provisionedSave.save({
          spec: dashboardWithDataSources,
          apiVersion: 'v2',
          uid: form.k8s?.name || dashboardUid || undefined,
          folderUid: String(form.folderUid ?? ''),
          title: form.dashboard.title,
          form: {
            ref: String(form.ref ?? ''),
            path: String(form.path ?? ''),
            comment: form.comment != null ? String(form.comment) : undefined,
            workflow: form.workflow != null ? String(form.workflow) : undefined,
          },
        });
      } else {
        onStandardSubmit(form);
      }
    },
    [
      isProvisioned,
      provisionedSave,
      isReadOnlyRepo,
      dashboard,
      dashboardUid,
      hasFloatGridItems,
      normalizedLayout,
      onStandardSubmit,
    ]
  );

  const canPushToConfiguredBranch = isProvisioned ? getCanPushToConfiguredBranch(repository) : false;
  const submitDisabled = isRepoLoading || isOrphaned || (isProvisioned && isReadOnlyRepo) || provisionedSave?.isLoading;

  return (
    <>
      {source === DashboardSource.Gcom && (
        <GcomDashboardInfo gnetId={undefined} orgName={meta.orgName} updatedAt={meta.updatedAt} />
      )}
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ImportDashboardFormV2
            register={register}
            inputs={inputs}
            errors={errors}
            control={control}
            getValues={getValues}
            onCancel={onCancel}
            onSubmit={onSubmit}
            watch={watch}
            hasFloatGridItems={hasFloatGridItems}
            submitDisabled={submitDisabled}
          >
            {isProvisioned && (
              <ProvisionedFieldsV2
                isReadOnlyRepo={isReadOnlyRepo}
                isOrphaned={isOrphaned}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                error={provisionedSave?.error}
              />
            )}
          </ImportDashboardFormV2>
        </form>
      </FormProvider>
    </>
  );
}

// Conditionally calls useImportProvisionedSave only when a repository is available.
function useProvisionedSaveIfAvailable(repository?: ReturnType<typeof useGetResourceRepositoryView>['repository']) {
  const fallbackRepo = FALLBACK_REPO;
  const result = useImportProvisionedSave({ repository: repository ?? fallbackRepo });
  return repository ? result : undefined;
}

const FALLBACK_REPO = {
  name: '',
  branch: '',
  type: 'local' as const,
  target: 'folder' as const,
  title: '',
  workflows: [],
};

// Provisioning-specific UI rendered as children of ImportDashboardFormV2
function ProvisionedFieldsV2({
  isReadOnlyRepo,
  isOrphaned,
  canPushToConfiguredBranch,
  repository,
  error,
}: {
  isReadOnlyRepo: boolean;
  isOrphaned: boolean;
  canPushToConfiguredBranch: boolean;
  repository?: ReturnType<typeof useGetResourceRepositoryView>['repository'];
  error?: string;
}) {
  return (
    <Stack direction="column" gap={2}>
      {(isReadOnlyRepo || isOrphaned) && (
        <RepoInvalidStateBanner noRepository={isOrphaned} isReadOnlyRepo={isReadOnlyRepo} />
      )}
      {!isReadOnlyRepo && !isOrphaned && (
        <ResourceEditFormSharedFields
          resourceType="dashboard"
          isNew
          canPushToConfiguredBranch={canPushToConfiguredBranch}
          repository={repository}
        />
      )}
      {error && <ProvisioningAlert error={error} />}
    </Stack>
  );
}
