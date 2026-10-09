import { type provisioning } from '@grafana/runtime';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { getManagerIdentity } from '../../utils/managedResource';
import { addResourceKinds, getKindInfoByGroupKind } from '../../utils/resourceKinds';

import { SaveProvisionedResourceDrawer } from './SaveProvisionedResourceDrawer';

/**
 * `provisioning.SaveResourceDrawer` in `@grafana/runtime`. For `create`, the repository comes from
 * `folderName` (folder-scoped kinds) or `repositoryName` (folderless kinds); for `update` and
 * `delete`, from the resource annotations.
 */
export function SaveResourceDrawer({
  resource,
  action,
  title,
  folderName,
  repositoryName,
  onDismiss,
  onWriteSuccess,
  onBranchSuccess,
}: provisioning.SaveResourceDrawerProps) {
  const isNew = action === 'create';
  const { repository, folder, isLoading } = useGetResourceRepositoryView(
    isNew ? { name: repositoryName, folderName } : { name: getManagerIdentity(resource) }
  );
  if (isLoading || !repository?.name) {
    return null;
  }

  const group = resource.apiVersion?.split('/')[0] ?? '';
  const kind = resource.kind ?? '';
  if (!getKindInfoByGroupKind(group, kind)) {
    addResourceKinds([{ group, kind }]);
  }

  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath] ?? '';
  const directory = folderPath.slice(0, folderPath.lastIndexOf('/') + 1);
  const common = {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    resource: resource as Parameters<typeof SaveProvisionedResourceDrawer>[0]['resource'],
    title,
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
    <SaveProvisionedResourceDrawer {...common} action="create" repositoryName={repository.name} directory={directory} />
  ) : (
    <SaveProvisionedResourceDrawer {...common} action={action} />
  );
}
