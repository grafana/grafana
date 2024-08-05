import { baseAPI as api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getFolders: build.query<GetFoldersApiResponse, GetFoldersApiArg>({
      query: (queryArg) => ({
        url: `/folders`,
        params: {
          limit: queryArg.limit,
          page: queryArg.page,
          parentUid: queryArg.parentUid,
          permission: queryArg.permission,
        },
      }),
    }),
    search: build.query<SearchApiResponse, SearchApiArg>({
      query: (queryArg) => ({
        url: `/search`,
        params: {
          query: queryArg.query,
          tag: queryArg.tag,
          type: queryArg['type'],
          dashboardIds: queryArg.dashboardIds,
          dashboardUIDs: queryArg.dashboardUiDs,
          folderIds: queryArg.folderIds,
          folderUIDs: queryArg.folderUiDs,
          starred: queryArg.starred,
          limit: queryArg.limit,
          page: queryArg.page,
          permission: queryArg.permission,
          sort: queryArg.sort,
          deleted: queryArg.deleted,
        },
      }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedAPI };
export type GetFoldersApiResponse = /** status 200 (empty) */ FolderSearchHit[];
export type GetFoldersApiArg = {
  /** Limit the maximum number of folders to return */
  limit?: number;
  /** Page index for starting fetching folders */
  page?: number;
  /** The parent folder UID */
  parentUid?: string;
  /** Set to `Edit` to return folders that the user can edit */
  permission?: 'Edit' | 'View';
};
export type SearchApiResponse = /** status 200 (empty) */ HitList;
export type SearchApiArg = {
  /** Search Query */
  query?: string;
  /** List of tags to search for */
  tag?: string[];
  /** Type to search for, dash-folder or dash-db */
  type?: 'dash-folder' | 'dash-db';
  /** List of dashboard id’s to search for
    This is deprecated: users should use the `dashboardUIDs` query parameter instead */
  dashboardIds?: number[];
  /** List of dashboard uid’s to search for */
  dashboardUiDs?: string[];
  /** List of folder id’s to search in for dashboards
    If it's `0` then it will query for the top level folders
    This is deprecated: users should use the `folderUIDs` query parameter instead */
  folderIds?: number[];
  /** List of folder UID’s to search in for dashboards
    If it's an empty string then it will query for the top level folders */
  folderUiDs?: string[];
  /** Flag indicating if only starred Dashboards should be returned */
  starred?: boolean;
  /** Limit the number of returned results (max 5000) */
  limit?: number;
  /** Use this parameter to access hits beyond limit. Numbering starts at 1. limit param acts as page size. Only available in Grafana v6.2+. */
  page?: number;
  /** Set to `Edit` to return dashboards/folders that the user can edit */
  permission?: 'Edit' | 'View';
  /** Sort method; for listing all the possible sort methods use the search sorting endpoint. */
  sort?: 'alpha-asc' | 'alpha-desc';
  /** Flag indicating if only soft deleted Dashboards should be returned */
  deleted?: boolean;
};
export type FolderSearchHit = {
  id?: number;
  parentUid?: string;
  title?: string;
  uid?: string;
};
export type ErrorResponseBody = {
  /** Error An optional detailed description of the actual error. Only included if running in developer mode. */
  error?: string;
  /** a human readable version of the error */
  message: string;
  /** Status An optional status to denote the cause of the error.
    
    For example, a 412 Precondition Failed error may include additional information of why that error happened. */
  status?: string;
};
export type HitType = string;
export type Hit = {
  folderId?: number;
  folderTitle?: string;
  folderUid?: string;
  folderUrl?: string;
  id?: number;
  isDeleted?: boolean;
  isStarred?: boolean;
  permanentlyDeleteDate?: string;
  slug?: string;
  sortMeta?: number;
  sortMetaName?: string;
  tags?: string[];
  title?: string;
  type?: HitType;
  uid?: string;
  uri?: string;
  url?: string;
};
export type HitList = Hit[];
export const { useGetFoldersQuery, useSearchQuery } = injectedRtkApi;
