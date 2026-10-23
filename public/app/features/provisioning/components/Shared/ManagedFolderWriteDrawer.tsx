import { useEffect, useRef, useState } from 'react';

import { API_GROUP as FOLDER_API_GROUP, API_VERSION as FOLDER_API_VERSION } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { getGenericKindInfo, getKindInfoByGroupKind } from '../../utils/resourceKinds';

import { SaveProvisionedResourceDrawer } from './SaveProvisionedResourceDrawer';

interface Resource {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string; annotations?: Record<string, string> };
  spec?: Record<string, unknown>;
}

export interface ManagedFolderWriteDrawerProps {
  resource: Resource;
  repositoryName: string;
  folderName: string;
  onDismiss?: () => void;
  /** Called with the stored resource after a commit to the configured branch. */
  onWritten?: (resource: unknown) => void;
  /** Called after a commit to another branch. The resource is not stored in Grafana yet. */
  onBranched?: (ref: string) => void;
  /** Called when the drawer closes without a commit. */
  onCancelled?: () => void;
}

/**
 * Opened by `backend_srv` when a write into a repository-managed folder is rejected: offers to
 * commit the resource to the repository instead. The file goes in the folder's directory.
 */
export function ManagedFolderWriteDrawer({
  resource,
  repositoryName,
  folderName,
  onDismiss,
  onWritten,
  onBranched,
  onCancelled,
}: ManagedFolderWriteDrawerProps) {
  const [folderDir, setFolderDir] = useState<string>();
  const settled = useRef(false);
  const settle = (fn?: () => void) => {
    if (!settled.current) {
      settled.current = true;
      fn?.();
    }
  };
  useEffect(() => () => settle(onCancelled), [onCancelled]);

  useEffect(() => {
    const url = `${getAPIBaseURL(FOLDER_API_GROUP, FOLDER_API_VERSION)}/folders/${folderName}`;
    getBackendSrv()
      .get<Resource>(url, undefined, undefined, { showErrorAlert: false })
      .then((folder) => {
        const path = folder.metadata?.annotations?.[AnnoKeySourcePath] ?? '';
        setFolderDir(path.slice(0, path.lastIndexOf('/') + 1));
      })
      .catch(() => setFolderDir(''));
  }, [folderName]);

  if (folderDir === undefined) {
    return null;
  }

  const group = resource.apiVersion?.split('/')[0] ?? '';
  const kind = resource.kind ?? '';
  const info = getKindInfoByGroupKind(group, kind) ?? getGenericKindInfo(group, kind);
  const spec = resource.spec ?? {};
  const title = String(spec.title ?? spec.name ?? resource.metadata?.name ?? kind);

  return (
    <SaveProvisionedResourceDrawer
      action="create"
      repositoryName={repositoryName}
      kind={info}
      resource={resource}
      title={title}
      directory={folderDir}
      onDismiss={() => {
        settle(onCancelled);
        onDismiss?.();
      }}
      onWriteSuccess={(stored) => {
        settle(() => onWritten?.(stored));
        onDismiss?.();
      }}
      onBranchSuccess={({ ref, urls, repoType, configuredBranch, repoUrl, prTitle }) => {
        locationService.partial({
          intercepted_write: 1,
          new_pull_request_url: urls?.newPullRequestURL,
          repo_url: urls?.repositoryURL ?? repoUrl,
          repo_type: repoType,
          repo_branch: configuredBranch,
          ref,
          pr_title: prTitle,
          action: 'create',
        });
        settle(() => onBranched?.(ref));
        onDismiss?.();
      }}
    />
  );
}
