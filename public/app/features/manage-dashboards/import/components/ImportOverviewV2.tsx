import { useCallback, useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AppEvents, locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { appEvents } from 'app/core/app_events';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

import { type DashboardInputs, DashboardSource, type ImportFormDataV2 } from '../../types';
import { useProvisionedImport } from '../hooks/useProvisionedImport';
import { truncateFloatGridItems } from '../utils/floatingGridItems';
import { applyV2Inputs } from '../utils/inputs';

import { GcomDashboardInfo } from './GcomDashboardInfo';
import { ImportDashboardFormV2 } from './ImportDashboardFormV2';
import { ProvisionedImportFields } from './ProvisionedImportFields';

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

  // Trigger initial validation (replicates Form's validateOnMount)
  useEffect(() => {
    trigger();
  }, [trigger]);

  const watchedFolderUid = watch('folderUid');

  const getDefaultTitle = useCallback(
    () => getValues('dashboard').title || dashboard.title || '',
    [getValues, dashboard.title]
  );

  const {
    isProvisioned,
    shouldRenderProvisionedFields,
    isOrphaned,
    isReadOnlyRepo,
    canPushToConfiguredBranch,
    repository,
    submitDisabled,
    save: saveProvisionedImport,
    error: provisionedError,
  } = useProvisionedImport({
    folderUid: watchedFolderUid,
    getDefaultTitle,
    setValue,
  });

  const hasProvisionedConflict =
    isProvisioned && Boolean(formState.errors.dashboard?.title || formState.errors.k8s?.name);
  const effectiveSubmitDisabled = submitDisabled || hasProvisionedConflict;

  const buildDashboardSpec = useCallback(
    (form: ImportFormDataV2): DashboardV2Spec => {
      const base: DashboardV2Spec = hasFloatGridItems ? { ...dashboard, layout: normalizedLayout } : dashboard;
      return { ...applyV2Inputs(base, form), title: form.dashboard.title };
    },
    [dashboard, hasFloatGridItems, normalizedLayout]
  );

  const onStandardSubmit = useCallback(
    async (form: ImportFormDataV2) => {
      reportInteraction(IMPORT_FINISHED_EVENT_NAME);
      try {
        const result = await (
          await getDashboardAPI('v2')
        ).saveDashboard({ ...form, dashboard: buildDashboardSpec(form) });
        if (result.url) {
          locationService.push(locationUtil.stripBaseFromUrl(result.url));
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        appEvents.emit(AppEvents.alertError, ['Dashboard import failed', msg]);
      }
    },
    [buildDashboardSpec]
  );

  const onSubmit = useCallback(
    (form: ImportFormDataV2) => {
      if (effectiveSubmitDisabled) {
        return;
      }
      if (isProvisioned) {
        reportInteraction(IMPORT_FINISHED_EVENT_NAME, { provisioned: true, workflow: form.workflow });
        saveProvisionedImport({
          spec: buildDashboardSpec(form),
          apiVersion: 'v2',
          uid: form.k8s?.name || dashboardUid || undefined,
          folderUid: form.folderUid ?? '',
          title: form.dashboard.title,
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
    [effectiveSubmitDisabled, isProvisioned, saveProvisionedImport, buildDashboardSpec, dashboardUid, onStandardSubmit]
  );

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
            errors={formState.errors}
            control={control}
            getValues={getValues}
            onCancel={onCancel}
            onSubmit={onSubmit}
            watch={watch}
            hasFloatGridItems={hasFloatGridItems}
            submitDisabled={effectiveSubmitDisabled}
          >
            {shouldRenderProvisionedFields && (
              <ProvisionedImportFields
                isReadOnlyRepo={isReadOnlyRepo}
                isOrphaned={isOrphaned}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                error={provisionedError}
              />
            )}
          </ImportDashboardFormV2>
        </form>
      </FormProvider>
    </>
  );
}
