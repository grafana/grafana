import { urlUtil } from '@grafana/data';
import { type ResourceWrapper } from 'app/api/clients/provisioning/v0alpha1';

import { splitPath } from '../components/utils/path';
import { FOLDER_METADATA_FILE } from '../constants';

import { FOLDER_DOC_TAB_PARAM, isMarkdownFile } from './folderDocConventions';
import { getKindInfoByResource, resourceKindInfos } from './resourceKinds';

type ReadRepositoryResource = (query: { path: string }) => Promise<ResourceWrapper>;

/**
 * Resolves a host-repository path through the files API. Markdown docs and
 * _folder.json links look up their containing folder, including legacy folders
 * without metadata files. Only an existing Grafana object provides a route.
 */
export function createGrafanaLinkResolver(
  readResource: ReadRepositoryResource,
  repositoryPath: string | undefined,
  readRootFolder?: () => Promise<string | undefined>
): (repoPath: string) => Promise<string | undefined> {
  const root = trimSlashes(repositoryPath ?? '');

  return async (repoPath) => {
    const normalized = trimSlashes(repoPath);
    // The files API expects paths relative to the configured root, not the Git root.
    if (root && normalized !== root && !normalized.startsWith(`${root}/`)) {
      return undefined;
    }
    let path = root ? normalized.slice(root.length).replace(/^\//, '') : normalized;
    let folder = repoPath.endsWith('/') || path === '';
    let docTab: string | undefined;

    if (isMarkdownFile(path)) {
      const { directory, filename } = splitPath(path);
      path = directory;
      docTab = filename;
      folder = true;
    } else if (path === FOLDER_METADATA_FILE || path.endsWith(`/${FOLDER_METADATA_FILE}`)) {
      path = splitPath(path).directory;
      folder = true;
    }

    if (folder && path) {
      path += '/';
    }
    let route: string | undefined;
    if (folder && !path) {
      // The empty files path lists repository contents; root folders need their own lookup.
      const name = await readRootFolder?.();
      route = name ? resourceKindInfos.folder.getRoute(name) : undefined;
    } else {
      const response = await readResource({ path: path.split('/').map(encodeURIComponent).join('/') });
      const type = response.resource?.type;
      const name = response.resource?.existing?.metadata?.name;
      if (response.errors?.length || typeof name !== 'string' || !name || !type?.resource) {
        return undefined;
      }
      const kind = getKindInfoByResource(type.resource);
      if (!kind || type.group !== kind.group || (folder && kind !== resourceKindInfos.folder)) {
        return undefined;
      }
      route = kind.getRoute?.(name);
    }
    return route && docTab ? urlUtil.renderUrl(route, { [FOLDER_DOC_TAB_PARAM]: docTab }) : route;
  };
}

function trimSlashes(s: string): string {
  return s.replace(/^\/+/, '').replace(/\/+$/, '');
}
