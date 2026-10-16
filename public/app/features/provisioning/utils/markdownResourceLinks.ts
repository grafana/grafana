import { locationUtil } from '@grafana/data';
import { type ResourceList, type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { splitPath } from '../components/utils/path';
import { FOLDER_METADATA_FILE } from '../constants';

import { FOLDER_DOC_TAB_PARAM, isMarkdownFile } from './folderDocConventions';
import { RESOURCE_PATH_ATTR, RESOURCE_ROUTE_ATTR, RESOURCE_SUFFIX_ATTR } from './markdownLinks';
import { getKindInfoByResource, resourceKindInfos } from './resourceKinds';

const LOOKUP_BATCH_SIZE = 50;

type LookupResources = (paths: string[]) => Promise<ResourceList>;

/**
 * Resolve the resource links already identified by rewriteRelativeMarkdownLinks.
 * The backend receives paths relative to the configured root, never Markdown or
 * host URLs. Unresolved links retain their host fallback.
 */
export async function resolveMarkdownResourceLinks(
  html: string,
  lookup: LookupResources,
  repositoryPath?: string
): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const targets = new Map<string, Array<{ anchor: Element; docTab?: string }>>();
  const root = trimSlashes(repositoryPath ?? '');

  for (const anchor of doc.querySelectorAll(`a[${RESOURCE_PATH_ATTR}]`)) {
    const repoPath = anchor.getAttribute(RESOURCE_PATH_ATTR)!;
    const normalized = trimSlashes(repoPath);
    if (root && normalized !== root && !normalized.startsWith(`${root}/`)) {
      continue;
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
    if (folder) {
      path += '/';
    }
    // Match the provisioning path contract so one unsupported link cannot reject a whole batch.
    if (
      path.length > 1024 ||
      !/^[a-zA-Z0-9 /_.-]+$/.test(path) ||
      (path !== '/' &&
        path.split('/').some((part, i, parts) => part.startsWith('.') || (!part && i < parts.length - 1)))
    ) {
      continue;
    }
    const links = targets.get(path) ?? [];
    links.push({ anchor, docTab });
    targets.set(path, links);
  }

  const paths = [...targets.keys()];
  for (let start = 0; start < paths.length; start += LOOKUP_BATCH_SIZE) {
    const batch = paths.slice(start, start + LOOKUP_BATCH_SIZE);
    const response = await lookup(batch);
    const matches = new Map<string, ResourceListItem | null>();
    for (const item of response.items ?? []) {
      const path = item.resource === 'folders' ? trimSlashes(item.path) + '/' : item.path;
      if (!batch.includes(path)) {
        continue;
      }
      // An orphaned duplicate at the same path is ambiguous; do not choose an arbitrary UID.
      matches.set(path, matches.has(path) ? null : item);
    }
    for (const path of batch) {
      const item = matches.get(path);
      const kind = item && getKindInfoByResource(item.resource);
      if (
        !item?.name ||
        !kind?.getRoute ||
        item.group !== kind.group ||
        (path.endsWith('/') && kind !== resourceKindInfos.folder)
      ) {
        continue;
      }
      for (const { anchor, docTab } of targets.get(path)!) {
        const route = new URL(
          kind.getRoute(encodeURIComponent(item.name)) + (anchor.getAttribute(RESOURCE_SUFFIX_ATTR) ?? ''),
          'http://localhost'
        );
        if (docTab) {
          route.searchParams.set(FOLDER_DOC_TAB_PARAM, docTab);
        }
        const destination = route.pathname + route.search + route.hash;
        anchor.setAttribute(RESOURCE_ROUTE_ATTR, destination);
        anchor.setAttribute('href', locationUtil.assureBaseUrl(destination));
        anchor.removeAttribute('target');
        anchor.removeAttribute('rel');
      }
    }
  }
  return doc.body.innerHTML;
}

function trimSlashes(s: string): string {
  return s.replace(/^\/+/, '').replace(/\/+$/, '');
}
