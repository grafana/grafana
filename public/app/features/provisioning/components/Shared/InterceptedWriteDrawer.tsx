import { useEffect, useRef, useState } from 'react';

import { API_GROUP as FOLDER_API_GROUP, API_VERSION as FOLDER_API_VERSION } from '@grafana/api-clients/rtkq/folder/v1beta1';
import {
  getBackendSrv,
  locationService,
  SaveResourceDrawer,
  type SaveResourceDrawerBranchCommit,
  type SaveResourceDrawerResource,
} from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { getKindInfoByGroupKind } from '../../utils/resourceKinds';

export interface InterceptedWriteDrawerProps {
  url: string;
  action: 'create' | 'update' | 'delete';
  resource?: SaveResourceDrawerResource;
  repositoryName?: string;
  folderName?: string;
  onDismiss?: () => void;
  onWritten: () => void;
  onBranched: () => void;
  onCancelled: () => void;
  onUnsupported: () => void;
}

const get = <T,>(url: string) => getBackendSrv().get<T>(url, undefined, undefined, { showErrorAlert: false });

export function InterceptedWriteDrawer({
  url,
  action,
  resource: submitted,
  repositoryName,
  folderName,
  onDismiss,
  onWritten,
  onBranched,
  onCancelled,
  onUnsupported,
}: InterceptedWriteDrawerProps) {
  const [resource, setResource] = useState(submitted);
  const [directory, setDirectory] = useState(folderName ? undefined : '');
  const settled = useRef(false);
  const settle = (fn: () => void) => {
    if (!settled.current) {
      settled.current = true;
      fn();
    }
  };

  useEffect(
    () => () => {
      if (!settled.current) {
        settled.current = true;
        onCancelled();
      }
    },
    [onCancelled]
  );

  useEffect(() => {
    if (!submitted) {
      get<SaveResourceDrawerResource>(url)
        .then(setResource)
        .catch(() => {
          settled.current = true;
          onUnsupported();
          onDismiss?.();
        });
    }
  }, [url, submitted, onUnsupported, onDismiss]);

  useEffect(() => {
    if (folderName) {
      get<SaveResourceDrawerResource>(`${getAPIBaseURL(FOLDER_API_GROUP, FOLDER_API_VERSION)}/folders/${folderName}`)
        .then((folder) => {
          const path = folder.metadata?.annotations?.[AnnoKeySourcePath] ?? '';
          setDirectory(path.slice(0, path.lastIndexOf('/') + 1));
        })
        .catch(() => setDirectory(''));
    }
  }, [folderName]);

  const supported = !resource || Boolean(getKindInfoByGroupKind(resource.apiVersion?.split('/')[0], resource.kind));
  useEffect(() => {
    if (!supported) {
      settled.current = true;
      onUnsupported();
      onDismiss?.();
    }
  }, [supported, onUnsupported, onDismiss]);

  if (!resource || !supported || directory === undefined) {
    return null;
  }

  const spec = resource.spec ?? {};
  const handlers = {
    resource,
    title: String(spec.title ?? spec.name ?? resource.metadata?.name ?? resource.kind ?? ''),
    directory,
    onDismiss: () => {
      settle(onCancelled);
      onDismiss?.();
    },
    onWriteSuccess: () => {
      settle(onWritten);
      onDismiss?.();
    },
    onBranchSuccess: ({ ref, urls, repoType, configuredBranch, repoUrl, prTitle }: SaveResourceDrawerBranchCommit) => {
      locationService.partial({
        intercepted_write: 1,
        new_pull_request_url: urls?.newPullRequestURL,
        repo_url: urls?.repositoryURL ?? repoUrl,
        repo_type: repoType,
        repo_branch: configuredBranch,
        ref,
        pr_title: prTitle,
        action,
      });
      settle(onBranched);
      onDismiss?.();
    },
  };

  return action === 'create' ? (
    <SaveResourceDrawer action="create" repositoryName={repositoryName ?? ''} {...handlers} />
  ) : (
    <SaveResourceDrawer action={action} {...handlers} />
  );
}
