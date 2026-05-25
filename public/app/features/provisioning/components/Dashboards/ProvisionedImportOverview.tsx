import { useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { getDataSourceSrv } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Folder } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { isRecord } from 'app/core/utils/isRecord';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
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
  folder?: Folder;
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
  folder,
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
    const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath];
    return {
      title,
      uid: dashboardUid ?? '',
      folderUid,
      workflow: getDefaultWorkflow(repository),
      ref: getDefaultRef(repository, 'import'),
      path: generatePath({ timestamp: generateTimestamp(), slug, folderPath }),
      comment: '',
      repo: repository.name,
    };
  }, [title, dashboardUid, folderUid, repository, folder]);

  const methods = useForm<ProvisionedImportFormData>({
    defaultValues,
    mode: 'onChange',
  });

  function onSubmit(form: ProvisionedImportFormData) {
    const spec = isDashboardV2Spec(dashboard)
      ? buildV2Spec(dashboard, form, normalizedLayout, hasFloatGridItems)
      : buildV1Spec(dashboard, form, inputs);

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

  const gnetId = isDashboardV2Spec(dashboard) ? undefined : dashboard.gnetId;

  return (
    <>
      {source === DashboardSource.Gcom && (
        <GcomDashboardInfo gnetId={gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
      )}
      <FormProvider {...methods}>
        <ProvisionedImportForm
          inputs={inputs}
          isReadOnlyRepo={isReadOnlyRepo}
          isOrphaned={false}
          isLibraryPanelImportBlocked={isLibraryPanelImportBlocked}
          hasFloatGridItems={hasFloatGridItems}
          canPushToConfiguredBranch={canPushToConfiguredBranch}
          repository={repository}
          isLoading={isLoading}
          error={error}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </FormProvider>
    </>
  );
}

function buildV2Spec(
  dash: DashboardV2Spec,
  form: ProvisionedImportFormData,
  normalizedLayout: DashboardV2Spec['layout'] | undefined,
  hasFloatGridItems: boolean
): DashboardV2Spec {
  const dashboardToSave = hasFloatGridItems && normalizedLayout ? { ...dash, layout: normalizedLayout } : dash;
  const formForV2: ImportFormDataV2 = { ...form, dashboard: dashboardToSave };
  return {
    ...applyV2Inputs(dashboardToSave, formForV2),
    title: form.title,
  };
}

function buildV1Spec(dash: Dashboard, form: ProvisionedImportFormData, inputs: DashboardInputs): Dashboard {
  const v1Form: ImportDashboardDTO = {
    title: form.title,
    uid: form.uid,
    gnetId: '',
    constants: inputs.constants.map((c) => {
      const val = form[`constant-${c.name}`];
      return typeof val === 'string' ? val : c.value;
    }),
    dataSources: inputs.dataSources.flatMap((ds) => {
      const selected = form[`datasource-${ds.name}`];
      if (!isRecord(selected) || typeof selected.uid !== 'string') {
        return [];
      }
      const settings = getDataSourceSrv().getInstanceSettings(selected.uid);
      return settings ? [settings] : [];
    }),
    elements: [],
    folder: { uid: form.folderUid },
  };
  return stripExportMetadata(applyV1Inputs(dash, inputs, v1Form));
}
