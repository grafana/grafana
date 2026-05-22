import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { GcomDashboardInfo } from 'app/features/manage-dashboards/import/components/GcomDashboardInfo';
import { truncateFloatGridItems } from 'app/features/manage-dashboards/import/utils/floatingGridItems';
import { applyV1Inputs, applyV2Inputs, stripExportMetadata } from 'app/features/manage-dashboards/import/utils/inputs';
import {
  type DashboardInputs,
  DashboardSource,
  type ImportDashboardDTO,
  type ImportFormDataV2,
} from 'app/features/manage-dashboards/types';

import { useImportProvisionedSave } from '../../hooks/useImportProvisionedSave';
import { getIsReadOnlyRepo } from '../../utils/repository';
import { getCanPushToConfiguredBranch, getDefaultRef, getDefaultWorkflow } from '../defaults';
import { generatePath, slugifyForFilename } from '../utils/path';
import { generateTimestamp } from '../utils/timestamp';

import { ProvisionedImportForm } from './ProvisionedImportForm';

export type ProvisionedImportFormData = {
  title: string;
  uid: string;
  folderUid: string;
  workflow?: string;
  ref: string;
  path: string;
  comment?: string;
  repo?: string;
} & Record<string, unknown>;

interface Props {
  dashboard: Dashboard | DashboardV2Spec;
  dashboardUid?: string;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  folderUid: string;
  repository: RepositoryView;
  onCancel: () => void;
}

export function ProvisionedImportOverview({
  dashboard,
  dashboardUid,
  inputs,
  meta,
  source,
  folderUid,
  repository,
  onCancel,
}: Props) {
  const isV2 = isDashboardV2Spec(dashboard);
  const isReadOnlyRepo = getIsReadOnlyRepo(repository);
  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);
  const isLibraryPanelImportBlocked = !isV2 && inputs.libraryPanels.length > 0;

  const { layout: normalizedLayout, modified: hasFloatGridItems } = useMemo(
    () =>
      isDashboardV2Spec(dashboard) ? truncateFloatGridItems(dashboard.layout) : { layout: undefined, modified: false },
    [dashboard]
  );

  const { save, isLoading, error } = useImportProvisionedSave({ repository });

  const title = isDashboardV2Spec(dashboard) ? (dashboard.title ?? '') : (dashboard.title ?? '');

  const defaultValues = useMemo<ProvisionedImportFormData>(() => {
    const slug = slugifyForFilename(title);
    return {
      title,
      uid: dashboardUid ?? '',
      folderUid,
      workflow: getDefaultWorkflow(repository),
      ref: getDefaultRef(repository, 'import'),
      path: generatePath({ timestamp: generateTimestamp(), slug }),
      comment: '',
      repo: repository.name,
    };
  }, [title, dashboardUid, folderUid, repository]);

  const methods = useForm<ProvisionedImportFormData>({
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    methods.trigger(['title', 'uid', 'path']);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitDisabled =
    isLibraryPanelImportBlocked ||
    isReadOnlyRepo ||
    isLoading ||
    methods.formState.isValidating ||
    !!methods.formState.errors.title ||
    !!methods.formState.errors.uid ||
    !!methods.formState.errors.path;

  function onSubmit(form: ProvisionedImportFormData) {
    const spec = isDashboardV2Spec(dashboard) ? buildV2Spec(dashboard, form) : buildV1Spec(dashboard, form);

    save({
      spec,
      apiVersion: isV2 ? 'v2' : 'v1',
      uid: form.uid || undefined,
      folderUid: form.folderUid,
      title: form.title,
      form: {
        ref: form.ref,
        path: form.path,
        comment: form.comment,
        workflow: form.workflow,
      },
    });
  }

  function buildV2Spec(dash: DashboardV2Spec, form: ProvisionedImportFormData): DashboardV2Spec {
    const dashboardToSave = hasFloatGridItems && normalizedLayout ? { ...dash, layout: normalizedLayout } : dash;

    // applyV2Inputs reads datasource-* and constant-* keys from the form.
    // ProvisionedImportFormData is compatible with ImportFormDataV2's index access pattern.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const formForV2 = form as unknown as ImportFormDataV2;
    return {
      ...applyV2Inputs(dashboardToSave, formForV2),
      title: form.title,
    };
  }

  function buildV1Spec(dash: Dashboard, form: ProvisionedImportFormData): Dashboard {
    // Build an ImportDashboardDTO-compatible shape for applyV1Inputs.
    // The dataSources array is populated from the form's DatasourceSelection values;
    // applyV1Inputs only reads .uid and .type from each entry.
    const v1Form: ImportDashboardDTO = {
      title: form.title,
      uid: form.uid,
      gnetId: '',
      constants: inputs.constants.map((c) => {
        const val = form[`constant-${c.name}`];
        return typeof val === 'string' ? val : c.value;
      }),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      dataSources: inputs.dataSources.map((ds) => {
        const selected = form[`datasource-${ds.name}`];
        return selected && typeof selected === 'object' ? selected : {};
      }) as ImportDashboardDTO['dataSources'],
      elements: [],
      folder: { uid: form.folderUid },
    };

    const dashboardWithInputs = applyV1Inputs(dash, inputs, v1Form);
    return stripExportMetadata(dashboardWithInputs);
  }

  const gnetId = isDashboardV2Spec(dashboard) ? undefined : dashboard.gnetId;

  return (
    <>
      {source === DashboardSource.Gcom && (
        <GcomDashboardInfo gnetId={gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
      )}
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} className={css({ maxWidth: '600px', width: '100%' })}>
          <ProvisionedImportForm
            register={methods.register}
            control={methods.control}
            getValues={methods.getValues}
            errors={methods.formState.errors}
            inputs={inputs}
            isReadOnlyRepo={isReadOnlyRepo}
            isOrphaned={false}
            isLibraryPanelImportBlocked={isLibraryPanelImportBlocked}
            hasFloatGridItems={hasFloatGridItems}
            canPushToConfiguredBranch={canPushToConfiguredBranch}
            repository={repository}
            submitDisabled={submitDisabled}
            isLoading={isLoading}
            error={error}
            onCancel={onCancel}
          />
        </form>
      </FormProvider>
    </>
  );
}
