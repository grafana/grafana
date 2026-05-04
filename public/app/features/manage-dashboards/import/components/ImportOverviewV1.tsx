import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents, locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { Alert, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { addLibraryPanel } from 'app/features/library-panels/state/api';
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

import { type DashboardInputs, DashboardSource, type ImportDashboardDTO, LibraryPanelInputState } from '../../types';
import { useImportProvisionedSave } from '../hooks/useImportProvisionedSave';
import { applyV1Inputs, interpolateLibraryPanelDatasources, stripExportMetadata } from '../utils/inputs';

import { GcomDashboardInfo } from './GcomDashboardInfo';
import { ImportForm } from './ImportForm';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

type Props = {
  dashboard: Dashboard;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  folderUid: string;
  onCancel: () => void;
};

export function ImportOverviewV1({ dashboard, inputs, meta, source, folderUid, onCancel }: Props) {
  const [uidReset, setUidReset] = useState(false);

  const methods = useForm<ImportDashboardDTO>({
    defaultValues: { ...dashboard, constants: [], dataSources: [], elements: [], folder: { uid: folderUid } },
    mode: 'onChange',
  });
  const { register, control, watch, getValues, setValue, handleSubmit, trigger, formState } = methods;
  const errors = formState.errors;

  // Trigger initial validation (replicates Form's validateOnMount + validateFieldsOnMount)
  useEffect(() => {
    trigger(['title', 'uid']);
  }, [trigger]);

  // --- Folder-based provisioning detection ---
  const watchedFolder = watch('folder');
  const currentFolderUid = watchedFolder?.uid ?? '';

  const { repository, status, isReadOnlyRepo } = useGetResourceRepositoryView({
    folderName: currentFolderUid || undefined,
  });

  const isProvisioned = status === RepoViewStatus.Ready && !!repository;
  const isOrphaned = status === RepoViewStatus.Orphaned;
  const isRepoLoading = status === RepoViewStatus.Loading;

  // Library panels block: provisioned import cannot create LPs via the API.
  const hasLibraryPanels = inputs.libraryPanels.length > 0;
  const isLPBlocked = isProvisioned && hasLibraryPanels;

  // --- Provisioned defaults: set once when repo becomes available, or when folder changes ---
  useEffect(() => {
    if (!isProvisioned || !repository) {
      return;
    }
    const workflow = getDefaultWorkflow(repository);
    const ref = getDefaultRef(repository, 'import');
    const title = getValues('title') || dashboard.title || '';
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
    async (form: ImportDashboardDTO) => {
      reportInteraction(IMPORT_FINISHED_EVENT_NAME);

      try {
        const dashboardWithDataSources = applyV1Inputs(dashboard, inputs, form);

        // Import new library panels first.
        const newLibraryPanels = inputs.libraryPanels.filter((lp) => lp.state === LibraryPanelInputState.New);
        for (const lp of newLibraryPanels) {
          const interpolatedModel = interpolateLibraryPanelDatasources(lp.model.model, inputs, form);
          const libPanelWithPanelModel = new PanelModel(interpolatedModel);
          let { scopedVars, ...panelSaveModel } = libPanelWithPanelModel.getSaveModel();
          panelSaveModel = {
            libraryPanel: {
              name: lp.model.name,
              uid: lp.model.uid,
            },
            ...panelSaveModel,
          };

          try {
            await addLibraryPanel(panelSaveModel, form.folder.uid, lp.model.uid);
          } catch (error) {
            appEvents.emit(AppEvents.alertWarning, [
              'Library panel import failed',
              `Could not import library panel "${lp.model.name}". It may already exist.`,
            ]);
          }
        }

        const cleanDashboard = stripExportMetadata(dashboardWithDataSources);

        const dashboardK8SPayload: SaveDashboardCommand<Dashboard> = {
          dashboard: cleanDashboard,
          k8s: {
            annotations: {
              'grafana.app/folder': form.folder.uid,
            },
          },
        };

        const api = await getDashboardAPI('v1');
        const result = await api.saveDashboard(dashboardK8SPayload);

        if (result.url) {
          const dashboardUrl = locationUtil.stripBaseFromUrl(result.url);
          locationService.push(dashboardUrl);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        appEvents.emit(AppEvents.alertError, ['Dashboard import failed', message]);
      }
    },
    [dashboard, inputs]
  );

  // --- Mode-aware submit handler ---
  const onSubmit = useCallback(
    (form: ImportDashboardDTO) => {
      if (isProvisioned && provisionedSave && !isLPBlocked && !isReadOnlyRepo) {
        reportInteraction(IMPORT_FINISHED_EVENT_NAME, {
          provisioned: true,
          workflow: form.workflow,
        });

        const dashboardWithDataSources = applyV1Inputs(dashboard, inputs, form);
        const cleanDashboard = stripExportMetadata(dashboardWithDataSources);

        provisionedSave.save({
          spec: cleanDashboard,
          apiVersion: 'v1',
          uid: uidReset ? form.uid : undefined,
          folderUid: form.folder.uid,
          title: form.title,
          form: {
            ref: form.ref ?? '',
            path: form.path ?? '',
            comment: form.comment,
            workflow: form.workflow,
          },
        });
      } else {
        onStandardSubmit(form);
      }
    },
    [isProvisioned, provisionedSave, isLPBlocked, isReadOnlyRepo, dashboard, inputs, uidReset, onStandardSubmit]
  );

  const canPushToConfiguredBranch = isProvisioned ? getCanPushToConfiguredBranch(repository) : false;
  const submitDisabled =
    isRepoLoading || isOrphaned || isLPBlocked || (isProvisioned && isReadOnlyRepo) || provisionedSave?.isLoading;

  return (
    <>
      {source === DashboardSource.Gcom && (
        <GcomDashboardInfo gnetId={dashboard.gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
      )}
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ImportForm
            register={register}
            errors={errors}
            control={control}
            getValues={getValues}
            uidReset={uidReset}
            inputs={inputs}
            onCancel={onCancel}
            onUidReset={() => setUidReset(true)}
            onSubmit={onSubmit}
            watch={watch}
            submitDisabled={submitDisabled}
          >
            {isProvisioned && (
              <ProvisionedFieldsV1
                isReadOnlyRepo={isReadOnlyRepo}
                isOrphaned={isOrphaned}
                isLPBlocked={isLPBlocked}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                error={provisionedSave?.error}
              />
            )}
          </ImportForm>
        </form>
      </FormProvider>
    </>
  );
}

// Conditionally calls useImportProvisionedSave only when a repository is available.
// Hooks must be called unconditionally, so we always call this at the same position.
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

// Provisioning-specific UI rendered as children of ImportForm
function ProvisionedFieldsV1({
  isReadOnlyRepo,
  isOrphaned,
  isLPBlocked,
  canPushToConfiguredBranch,
  repository,
  error,
}: {
  isReadOnlyRepo: boolean;
  isOrphaned: boolean;
  isLPBlocked: boolean;
  canPushToConfiguredBranch: boolean;
  repository?: ReturnType<typeof useGetResourceRepositoryView>['repository'];
  error?: string;
}) {
  return (
    <Stack direction="column" gap={2}>
      {(isReadOnlyRepo || isOrphaned) && (
        <RepoInvalidStateBanner noRepository={isOrphaned} isReadOnlyRepo={isReadOnlyRepo} />
      )}
      {isLPBlocked && (
        <Alert
          severity="warning"
          title={t('manage-dashboards.import-provisioned.library-panels-blocked-title', 'Library panels not supported')}
        >
          <Trans i18nKey="manage-dashboards.import-provisioned.library-panels-blocked-body">
            This dashboard contains library panels that cannot be created through a provisioned import. Import into a
            non-provisioned folder instead, or remove the library panel references first.
          </Trans>
        </Alert>
      )}
      {!isLPBlocked && !isReadOnlyRepo && !isOrphaned && (
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
