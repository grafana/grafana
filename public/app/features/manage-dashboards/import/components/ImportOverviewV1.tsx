import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents, locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { addLibraryPanel } from 'app/features/library-panels/state/api';

import { type DashboardInputs, DashboardSource, type ImportDashboardDTO, LibraryPanelInputState } from '../../types';
import { useProvisionedImport, type ProvisionedImportDefaults } from '../hooks/useProvisionedImport';
import { applyV1Inputs, interpolateLibraryPanelDatasources, stripExportMetadata } from '../utils/inputs';

import { GcomDashboardInfo } from './GcomDashboardInfo';
import { ImportForm } from './ImportForm';
import { ProvisionedImportFields } from './ProvisionedImportFields';

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

  // Trigger initial validation (replicates Form's validateOnMount + validateFieldsOnMount)
  useEffect(() => {
    trigger(['title', 'uid']);
  }, [trigger]);

  const watchedFolder = watch('folder');

  const getDefaultTitle = useCallback(() => getValues('title') || dashboard.title || '', [getValues, dashboard.title]);
  const applyDefaults = useCallback(
    ({ workflow, ref, path, repo }: ProvisionedImportDefaults) => {
      setValue('workflow', workflow, { shouldDirty: false });
      setValue('ref', ref, { shouldDirty: false });
      setValue('path', path, { shouldDirty: false });
      setValue('repo', repo, { shouldDirty: false });
    },
    [setValue]
  );

  const {
    isProvisioned,
    shouldRenderProvisionedFields,
    isOrphaned,
    isReadOnlyRepo,
    isLPBlocked,
    canPushToConfiguredBranch,
    repository,
    submitDisabled,
    save: saveProvisionedImport,
    error: provisionedError,
  } = useProvisionedImport({
    folderUid: watchedFolder?.uid,
    getDefaultTitle,
    applyDefaults,
    hasLibraryPanels: inputs.libraryPanels.length > 0,
  });

  const onStandardSubmit = useCallback(
    async (form: ImportDashboardDTO) => {
      reportInteraction(IMPORT_FINISHED_EVENT_NAME);
      try {
        const dashboardWithDS = applyV1Inputs(dashboard, inputs, form);

        for (const lp of inputs.libraryPanels.filter((lp) => lp.state === LibraryPanelInputState.New)) {
          const model = new PanelModel(interpolateLibraryPanelDatasources(lp.model.model, inputs, form));
          const { scopedVars, ...saveModel } = model.getSaveModel();
          try {
            await addLibraryPanel(
              { libraryPanel: { name: lp.model.name, uid: lp.model.uid }, ...saveModel },
              form.folder.uid,
              lp.model.uid
            );
          } catch {
            appEvents.emit(AppEvents.alertWarning, [
              'Library panel import failed',
              `Could not import library panel "${lp.model.name}". It may already exist.`,
            ]);
          }
        }

        const payload: SaveDashboardCommand<Dashboard> = {
          dashboard: stripExportMetadata(dashboardWithDS),
          k8s: { annotations: { 'grafana.app/folder': form.folder.uid } },
        };
        const result = await (await getDashboardAPI('v1')).saveDashboard(payload);
        if (result.url) {
          locationService.push(locationUtil.stripBaseFromUrl(result.url));
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        appEvents.emit(AppEvents.alertError, ['Dashboard import failed', msg]);
      }
    },
    [dashboard, inputs]
  );

  const onSubmit = useCallback(
    (form: ImportDashboardDTO) => {
      if (submitDisabled) {
        return;
      }
      if (isProvisioned) {
        reportInteraction(IMPORT_FINISHED_EVENT_NAME, { provisioned: true, workflow: form.workflow });
        saveProvisionedImport({
          spec: stripExportMetadata(applyV1Inputs(dashboard, inputs, form)),
          apiVersion: 'v1',
          uid: uidReset ? form.uid : undefined,
          folderUid: form.folder.uid,
          title: form.title,
          form: { ref: form.ref ?? '', path: form.path ?? '', comment: form.comment, workflow: form.workflow },
        });
        return;
      }
      onStandardSubmit(form);
    },
    [submitDisabled, isProvisioned, saveProvisionedImport, dashboard, inputs, uidReset, onStandardSubmit]
  );

  return (
    <>
      {source === DashboardSource.Gcom && (
        <GcomDashboardInfo gnetId={dashboard.gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
      )}
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ImportForm
            register={register}
            errors={formState.errors}
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
            {shouldRenderProvisionedFields && (
              <ProvisionedImportFields
                isReadOnlyRepo={isReadOnlyRepo}
                isOrphaned={isOrphaned}
                isLPBlocked={isLPBlocked}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                error={provisionedError}
              />
            )}
          </ImportForm>
        </form>
      </FormProvider>
    </>
  );
}
