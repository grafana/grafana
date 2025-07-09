import { PanelModel } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { FolderDTO } from 'app/types/folders';

import { Options } from './panelcfg.gen';

async function getFolderUID(folderID: number): Promise<string> {
  // folderID 0 is always the fake General/Dashboards folder, which always has a UID of empty string
  if (folderID === 0) {
    return '';
  }

  const folderDTO = await getBackendSrv().get<FolderDTO>(`/api/folders/id/${folderID}`, undefined, undefined, {
    showErrorAlert: false,
  });

  return folderDTO.uid;
}

export interface AngularModel {
  /** @deprecated */
  starred?: boolean;
  /** @deprecated */
  recent?: boolean;
  /** @deprecated */
  search?: boolean;
  /** @deprecated */
  headings?: boolean;
  /** @deprecated */
  limit?: number;
  /** @deprecated */
  query?: string;
  /** @deprecated */
  folderId?: number;
  /** @deprecated */
  tags?: string[];
}

export async function dashlistMigrationHandler(panel: PanelModel<Options> & AngularModel) {
  // Convert old angular model to new react model
  const newOptions: Options = {
    ...panel.options,
    showStarred: panel.options.showStarred ?? panel.starred,
    showRecentlyViewed: panel.options.showRecentlyViewed ?? panel.recent,
    showSearch: panel.options.showSearch ?? panel.search,
    showHeadings: panel.options.showHeadings ?? panel.headings,
    maxItems: panel.options.maxItems ?? panel.limit,
    query: panel.options.query ?? panel.query,
    folderId: panel.options.folderId ?? panel.folderId,
    tags: panel.options.tags ?? panel.tags,
  };

  // Delete old angular properties
  const previousVersion = parseFloat(panel.pluginVersion || '6.1');
  if (previousVersion < 6.3) {
    const oldProps = ['starred', 'recent', 'search', 'headings', 'limit', 'query', 'folderId'] as const;
    oldProps.forEach((prop) => delete panel[prop]);
  }

  // Convert the folderId to folderUID. Uses the API to do the conversion.
  if (newOptions.folderId !== undefined) {
    const folderId = newOptions.folderId;

    // If converting ID to UID fails, the panel will not be migrated and will show incorrectly
    try {
      const folderUID = await getFolderUID(folderId);
      newOptions.folderUID = folderUID;
      delete newOptions.folderId;
    } catch (err) {
      console.warn('Dashlist: Error migrating folder ID to UID', err);
    }
  }

  return newOptions;
}
