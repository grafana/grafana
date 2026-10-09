import { useState } from 'react';

import { type provisioning } from '@grafana/runtime';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { useResourceRepositorySelection } from '../../hooks/useResourceRepositorySelection';
import { getManagerIdentity } from '../../utils/managedResource';
import { addResourceKinds, getKindInfoByGroupKind, type ResourceKindInfo } from '../../utils/resourceKinds';

import { RepositorySelect } from './RepositorySelect';
import { SaveProvisionedResourceDrawer } from './SaveProvisionedResourceDrawer';

/**
 * `provisioning.SaveResourceDrawer` in `@grafana/runtime`. One drawer for the resource fields
 * (`children`) and the commit fields. The repository comes from `folderName` (folder-scoped kinds),
 * from a picker in the drawer (folderless kinds with `onSave`), or from the resource annotations
 * (`update` and `delete`).
 */
export function SaveResourceDrawer({
  resource,
  action,
  title,
  folderName,
  children,
  getSpec,
  onSave,
  onDismiss,
  onWriteSuccess,
  onBranchSuccess,
}: provisioning.SaveResourceDrawerProps) {
  const isNew = action === 'create';
  const group = resource.apiVersion?.split('/')[0] ?? '';
  const kindName = resource.kind ?? '';
  const kind = useKindInfo(group, kindName);

  // Folderless create: the user picks the repository in the drawer. No pick means a Grafana save.
  const showPicker = isNew && !folderName && Boolean(onSave);
  const [pickedRepository, setPickedRepository] = useState<string>();
  const { isAvailable, repositories } = useResourceRepositorySelection(kind);

  const { repository, folder, isLoading } = useGetResourceRepositoryView(
    isNew
      ? { name: pickedRepository, folderName, skipQuery: !folderName && !pickedRepository }
      : { name: getManagerIdentity(resource) }
  );
  if (isLoading) {
    return null;
  }
  // A repository is required unless the caller can store the resource in Grafana.
  if (!repository?.name && !onSave) {
    return null;
  }

  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath] ?? '';
  const directory = folderPath.slice(0, folderPath.lastIndexOf('/') + 1);
  const fields = (
    <>
      {children}
      {showPicker && isAvailable && (
        <RepositorySelect repositories={repositories} value={pickedRepository} onChange={setPickedRepository} />
      )}
    </>
  );
  const common = {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    resource: resource as Parameters<typeof SaveProvisionedResourceDrawer>[0]['resource'],
    title,
    getSpec,
    onSave,
    onDismiss,
    onWriteSuccess: onWriteSuccess ?? onDismiss,
    onBranchSuccess: (data: {
      ref: string;
      urls?: Record<string, string>;
      repoUrl?: string;
      repoType?: string;
      configuredBranch?: string;
    }) =>
      (onBranchSuccess ?? onDismiss)?.({
        ref: data.ref,
        pullRequestUrl: data.urls?.newPullRequestURL,
        repositoryUrl: data.urls?.repositoryURL ?? data.repoUrl,
        repoType: data.repoType,
        configuredBranch: data.configuredBranch,
      }),
  };

  return isNew ? (
    <SaveProvisionedResourceDrawer {...common} action="create" repositoryName={repository?.name} directory={directory}>
      {fields}
    </SaveProvisionedResourceDrawer>
  ) : (
    <SaveProvisionedResourceDrawer {...common} action={action}>
      {fields}
    </SaveProvisionedResourceDrawer>
  );
}

function useKindInfo(group: string, kind: string): ResourceKindInfo {
  let info = getKindInfoByGroupKind(group, kind);
  if (!info) {
    addResourceKinds([{ group, kind }]);
    info = getKindInfoByGroupKind(group, kind)!;
  }
  return info;
}
