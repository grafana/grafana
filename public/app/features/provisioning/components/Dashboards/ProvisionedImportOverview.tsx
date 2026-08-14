import { useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Alert } from '@grafana/ui';
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

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useImportProvisionedSave } from '../../hooks/useImportProvisionedSave';
import { type BaseProvisionedFormData } from '../../types/form';
import { getIsReadOnlyRepo } from '../../utils/repository';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { getCanPushToConfiguredBranch, getDefaultRef, getDefaultWorkflow } from '../defaults';
import { generatePath, slugifyForFilename } from '../utils/path';
import { generateTimestamp } from '../utils/timestamp';

import { ProvisionedImportForm } from './ProvisionedImportForm';

export type ProvisionedImportFormData = BaseProvisionedFormData & {
  ref: string;
  uid: string;
  folderUid: string;
} & Record<string, unknown>;

interface Props {
  dashboard: Dashboard | DashboardV2Spec;
  dashboardUid?: string;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  folderUid: string;
  status: RepoViewStatus;
  repository?: RepositoryView;
  folder?: Folder;
  onFolderChange?: (uid: string) => void;
  onCancel: () => void;
}

export function ProvisionedImportOverview({ status, repository, ...rest }: Props) {
  // Fail closed — standard import must not write into a repo-managed folder.
  if (status === RepoViewStatus.Orphaned) {
    return <RepoInvalidStateBanner noRepository isReadOnlyRepo={false} />;
  }

  // Fail closed — can't confirm the folder isn't repo-managed.
  if (status === RepoViewStatus.Error) {
    return (
      <Alert
        title={t('import-overview.error-provisioning-status-title', 'Unable to determine provisioning status')}
        severity="error"
      >
        <Trans i18nKey="import-overview.error-provisioning-status">
          Could not check whether the target folder is managed by a repository. Please try again or contact an
          administrator.
        </Trans>
      </Alert>
    );
  }

  if (status !== RepoViewStatus.Ready || !repository) {
    return null;
  }

  return <ProvisionedImportOverviewReady {...rest} repository={repository} />;
}

type ReadyProps = Omit<Props, 'status' | 'repository'> & { repository: RepositoryView };

function ProvisionedImportOverviewReady({
  dashboard,
  dashboardUid,
  inputs,
  meta,
  source,
  folderUid,
  repository,
  folder,
  onFolderChange,
  onCancel,
}: ReadyProps) {
  const isV2 = isDashboardV2Spec(dashboard);
  const isReadOnlyRepo = getIsReadOnlyRepo(repository);
  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);
  const isLibraryPanelImportBlocked = !isV2 && inputs.libraryPanels.length > 0;

  const { layout: normalizedLayout, modified: hasFloatGridItems } = useMemo(
    () => (isV2 ? truncateFloatGridItems(dashboard.layout) : { layout: undefined, modified: false }),
    [dashboard, isV2]
  );

  const { save, isLoading, error } = useImportProvisionedSave({ repository });

  const title = dashboard.title ?? '';

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

  async function onSubmit(form: ProvisionedImportFormData) {
    const spec = isV2
      ? buildV2Spec(dashboard, form, normalizedLayout, hasFloatGridItems)
      : await buildV1Spec(dashboard, form, inputs);

    await save({
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

  const gnetId = isV2 ? undefined : dashboard.gnetId;

  return (
    <>
      {source === DashboardSource.Gcom && (
        <GcomDashboardInfo gnetId={gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
      )}
      <FormProvider {...methods}>
        <ProvisionedImportForm
          inputs={inputs}
          isReadOnlyRepo={isReadOnlyRepo}
          isLibraryPanelImportBlocked={isLibraryPanelImportBlocked}
          hasFloatGridItems={hasFloatGridItems}
          canPushToConfiguredBranch={canPushToConfiguredBranch}
          repository={repository}
          isLoading={isLoading}
          error={error}
          onFolderChange={onFolderChange}
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

async function buildV1Spec(
  dash: Dashboard,
  form: ProvisionedImportFormData,
  inputs: DashboardInputs
): Promise<Dashboard> {
  const resolvedDataSources = await Promise.all(
    inputs.dataSources.map((ds) => {
      const selected = form[`datasource-${ds.name}`];
      if (!isRecord(selected) || typeof selected.uid !== 'string') {
        return undefined;
      }
      return getDataSourceInstanceSettings(selected.uid);
    })
  );

  const v1Form: ImportDashboardDTO = {
    title: form.title,
    uid: form.uid,
    gnetId: '',
    constants: inputs.constants.map((c) => {
      const val = form[`constant-${c.name}`];
      return typeof val === 'string' ? val : c.value;
    }),
    dataSources: resolvedDataSources.filter((settings) => settings !== undefined),
    elements: [],
    folder: { uid: form.folderUid },
  };
  return stripExportMetadata(applyV1Inputs(dash, inputs, v1Form));
}
