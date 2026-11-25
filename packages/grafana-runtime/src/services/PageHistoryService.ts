/** The kinds of page Grafana records in a user's page history. */
export type PageHistoryItemKind =
  | 'dashboard'
  | 'folder'
  | 'notebook'
  | 'playlist'
  | 'page'
  | 'explore'
  | 'alerting'
  | 'app';

/** One page the user visited. */
export interface PageHistoryItem {
  kind: PageHistoryItemKind;
  /** The uid (`metadata.name`) of the object, for the kinds that are one: dashboards, folders, notebooks and playlists. */
  uid?: string;
  /** Path of the page, without the app sub path or a trailing slash. */
  pathname: string;
  /** Epoch ms of the last visit. Absent on rows that carry no time. */
  lastVisited?: number;
}

/** The pages the signed-in user visited, as Grafana records them. */
export interface PageHistoryService {
  /**
   * The user's recorded pages, newest first, one per page and capped per kind. Empty when Grafana
   * records nothing for this session, such as for an anonymous user.
   */
  getEntries: () => Promise<PageHistoryItem[]>;
}

let singletonInstance: PageHistoryService | undefined;

/**
 * Used during startup by Grafana to set the PageHistoryService so it is available
 * via {@link getPageHistoryService} to the rest of the application.
 *
 * @internal
 */
export function setPageHistoryService(instance: PageHistoryService) {
  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link PageHistoryService}. Throws until Grafana has set it at startup.
 */
export function getPageHistoryService(): PageHistoryService {
  if (!singletonInstance) {
    throw new Error(
      'PageHistoryService is not set. Grafana sets it at startup; plugin tests mock getPageHistoryService.'
    );
  }
  return singletonInstance;
}
