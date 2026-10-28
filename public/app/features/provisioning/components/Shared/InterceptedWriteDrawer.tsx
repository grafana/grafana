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

import { addResourceKinds, getKindInfoByGroupKind } from '../../utils/resourceKinds';

export interface InterceptedWriteDrawerProps {
  url: string;
  action: 'create' | 'update' | 'delete';
  resource?: SaveResourceDrawerResource;
  patch?: object;
  repositoryName?: string;
  folderName?: string;
  onDismiss?: () => void;
  onWritten: () => void;
  onBranched: () => void;
  onCancelled: () => void;
  onUnsupported: () => void;
}

const get = <T,>(url: string) => getBackendSrv().get<T>(url, undefined, undefined, { showErrorAlert: false });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isResource = (value: unknown): value is SaveResourceDrawerResource => isObject(value);

function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isObject(patch)) {
    return patch;
  }
  const result: Record<string, unknown> = isObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
    } else {
      result[key] = mergePatch(result[key], value);
    }
  }
  return result;
}

function ensureKindRegistered(url: string, resource: SaveResourceDrawerResource) {
  const group = resource.apiVersion?.split('/')[0];
  const kind = resource.kind;
  if (group && kind && !getKindInfoByGroupKind(group, kind)) {
    addResourceKinds([{ group, kind, resource: url.replace(/^\//, '').split('/')[5] }]);
  }
}

export function InterceptedWriteDrawer({
  url,
  action,
  resource: submitted,
  patch,
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
        .then((current) => {
          const patched = patch ? mergePatch(current, patch) : current;
          setResource(isResource(patched) ? patched : current);
        })
        .catch(() => {
          settled.current = true;
          onUnsupported();
          onDismiss?.();
        });
    }
  }, [url, submitted, patch, onUnsupported, onDismiss]);

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

  if (!resource || directory === undefined) {
    return null;
  }
  ensureKindRegistered(url, resource);

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
