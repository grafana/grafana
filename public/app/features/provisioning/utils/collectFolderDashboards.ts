import { listDashboards } from 'app/features/browse-dashboards/api/services';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

/**
 * Recursively collects all dashboards under a folder and its children
 * @param folderUID - The UID of the folder to collect dashboards from
 * @returns Array of dashboard UIDs
 */
export async function collectAllDashboardsUnderFolder(folderUID: string): Promise<string[]> {
  const dashboardUIDs: string[] = [];
  const foldersToProcess: string[] = [folderUID];
  const processedFolders = new Set<string>();

  while (foldersToProcess.length > 0) {
    const currentFolderUID = foldersToProcess.shift()!;
    
    if (processedFolders.has(currentFolderUID)) {
      continue;
    }
    processedFolders.add(currentFolderUID);

    // Get dashboards directly in this folder
    let page = 1;
    const pageSize = 100; // Use a reasonable page size
    let hasMore = true;

    while (hasMore) {
      const dashboards = await listDashboards(currentFolderUID, page, pageSize);
      
      for (const dashboard of dashboards) {
        dashboardUIDs.push(dashboard.uid);
      }

      hasMore = dashboards.length === pageSize;
      page++;
    }

    // Get child folders and add them to the processing queue
    // We need to use the search API to find child folders
    const searcher = getGrafanaSearcher();
    
    const foldersResults = await searcher.search({
      kind: ['folder'],
      query: '*',
      location: currentFolderUID || 'general',
      limit: 100,
    });

    for (const folderItem of foldersResults.view) {
      const folderUID = folderItem.uid;
      if (folderUID && !processedFolders.has(folderUID)) {
        foldersToProcess.push(folderUID);
      }
    }
  }

  return dashboardUIDs;
}

