import { baseAPI as api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCloudMigrationRun: build.query<GetCloudMigrationRunApiResponse, GetCloudMigrationRunApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/run/${queryArg.runUid}` }),
    }),
    getCloudMigrationRunList: build.query<GetCloudMigrationRunListApiResponse, GetCloudMigrationRunListApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.uid}/run` }),
    }),
    runCloudMigration: build.mutation<RunCloudMigrationApiResponse, RunCloudMigrationApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.uid}/run`, method: 'POST' }),
    }),
    createCloudMigrationToken: build.mutation<CreateCloudMigrationTokenApiResponse, CreateCloudMigrationTokenApiArg>({
      query: () => ({ url: `/cloudmigration/token`, method: 'POST' }),
    }),
    getDashboardByUid: build.query<GetDashboardByUidApiResponse, GetDashboardByUidApiArg>({
      query: (queryArg) => ({ url: `/dashboards/uid/${queryArg.uid}` }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedAPI };
export type GetCloudMigrationRunApiResponse = /** status 200 (empty) */ MigrateSnapshotResponseDto;
export type GetCloudMigrationRunApiArg = {
  /** RunUID of a migration run */
  runUid: string;
};
export type GetCloudMigrationRunListApiResponse = /** status 200 (empty) */ SnapshotList;
export type GetCloudMigrationRunListApiArg = {
  /** UID of a migration */
  uid: string;
};
export type RunCloudMigrationApiResponse = /** status 200 (empty) */ MigrateSnapshotResponseDto;
export type RunCloudMigrationApiArg = {
  /** UID of a migration */
  uid: string;
};
export type CreateCloudMigrationTokenApiResponse = /** status 200 (empty) */ CreateAccessTokenResponseDto;
export type CreateCloudMigrationTokenApiArg = void;
export type GetDashboardByUidApiResponse = /** status 200 (empty) */ DashboardFullWithMeta;
export type GetDashboardByUidApiArg = {
  uid: string;
};
export type MigrateSnapshotResponseItemDto = {
  error?: string;
  refId: string;
  status: 'OK' | 'ERROR';
  type: 'DASHBOARD' | 'DATASOURCE' | 'FOLDER';
};
export type MigrateSnapshotResponseDto = {
  items?: MigrateSnapshotResponseItemDto[];
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
export type MigrateSnapshotResponseListDto = {
  uid?: string;
};
export type SnapshotList = {
  runs?: MigrateSnapshotResponseListDto[];
};
export type CreateAccessTokenResponseDto = {
  token?: string;
};
export type Json = object;
export type AnnotationActions = {
  canAdd?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
};
export type AnnotationPermission = {
  dashboard?: AnnotationActions;
  organization?: AnnotationActions;
};
export type DashboardMeta = {
  annotationsPermissions?: AnnotationPermission;
  canAdmin?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  canSave?: boolean;
  canStar?: boolean;
  created?: string;
  createdBy?: string;
  expires?: string;
  /** Deprecated: use FolderUID instead */
  folderId?: number;
  folderTitle?: string;
  folderUid?: string;
  folderUrl?: string;
  hasAcl?: boolean;
  isFolder?: boolean;
  isSnapshot?: boolean;
  isStarred?: boolean;
  provisioned?: boolean;
  provisionedExternalId?: string;
  publicDashboardEnabled?: boolean;
  slug?: string;
  type?: string;
  updated?: string;
  updatedBy?: string;
  url?: string;
  version?: number;
};
export type DashboardFullWithMeta = {
  dashboard?: Json;
  meta?: DashboardMeta;
};
export const {
  useGetCloudMigrationRunQuery,
  useGetCloudMigrationRunListQuery,
  useRunCloudMigrationMutation,
  useCreateCloudMigrationTokenMutation,
  useGetDashboardByUidQuery,
} = injectedRtkApi;
