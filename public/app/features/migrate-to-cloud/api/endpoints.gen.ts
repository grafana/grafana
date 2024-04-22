import { baseAPI as api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getMigrationList: build.query<GetMigrationListApiResponse, GetMigrationListApiArg>({
      query: () => ({ url: `/cloudmigration/migration` }),
    }),
    createMigration: build.mutation<CreateMigrationApiResponse, CreateMigrationApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration`, method: 'POST', body: queryArg.cloudMigrationRequest }),
    }),
    deleteCloudMigration: build.mutation<DeleteCloudMigrationApiResponse, DeleteCloudMigrationApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.id}`, method: 'DELETE' }),
    }),
    getCloudMigration: build.query<GetCloudMigrationApiResponse, GetCloudMigrationApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.id}` }),
    }),
    getCloudMigrationRunList: build.query<GetCloudMigrationRunListApiResponse, GetCloudMigrationRunListApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.id}/run` }),
    }),
    runCloudMigration: build.mutation<RunCloudMigrationApiResponse, RunCloudMigrationApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.id}/run`, method: 'POST' }),
    }),
    getCloudMigrationRun: build.query<GetCloudMigrationRunApiResponse, GetCloudMigrationRunApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.id}/run/${queryArg.runId}` }),
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
export type GetMigrationListApiResponse = /** status 200 (empty) */ CloudMigrationListResponse;
export type GetMigrationListApiArg = void;
export type CreateMigrationApiResponse = /** status 200 (empty) */ CloudMigrationResponse;
export type CreateMigrationApiArg = {
  cloudMigrationRequest: CloudMigrationRequest;
};
export type DeleteCloudMigrationApiResponse = unknown;
export type DeleteCloudMigrationApiArg = {
  /** ID of an migration */
  id: number;
};
export type GetCloudMigrationApiResponse = /** status 200 (empty) */ CloudMigrationResponse;
export type GetCloudMigrationApiArg = {
  /** ID of an migration */
  id: number;
};
export type GetCloudMigrationRunListApiResponse = /** status 200 (empty) */ CloudMigrationRunList;
export type GetCloudMigrationRunListApiArg = {
  /** ID of an migration */
  id: number;
};
export type RunCloudMigrationApiResponse = /** status 200 (empty) */ MigrateDataResponseDto;
export type RunCloudMigrationApiArg = {
  /** ID of an migration */
  id: number;
};
export type GetCloudMigrationRunApiResponse = /** status 200 (empty) */ MigrateDataResponseDto;
export type GetCloudMigrationRunApiArg = {
  /** ID of an migration */
  id: number;
  /** Run ID of a migration run */
  runId: number;
};
export type CreateCloudMigrationTokenApiResponse = /** status 200 (empty) */ CreateAccessTokenResponseDto;
export type CreateCloudMigrationTokenApiArg = void;
export type GetDashboardByUidApiResponse = /** status 200 (empty) */ DashboardFullWithMeta;
export type GetDashboardByUidApiArg = {
  uid: string;
};
export type CloudMigrationResponse = {
  created?: string;
  id?: number;
  stack?: string;
  updated?: string;
};
export type CloudMigrationListResponse = {
  migrations?: CloudMigrationResponse[];
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
export type CloudMigrationRequest = {
  authToken?: string;
};
export type MigrateDataResponseItemDto = {
  error?: string;
  refId: string;
  status: 'OK' | 'ERROR';
  type: 'DASHBOARD' | 'DATASOURCE' | 'FOLDER';
};
export type MigrateDataResponseDto = {
  id?: number;
  items?: MigrateDataResponseItemDto[];
};
export type CloudMigrationRunList = {
  runs?: MigrateDataResponseDto[];
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
  publicDashboardUid?: string;
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
  useGetMigrationListQuery,
  useCreateMigrationMutation,
  useDeleteCloudMigrationMutation,
  useGetCloudMigrationQuery,
  useGetCloudMigrationRunListQuery,
  useRunCloudMigrationMutation,
  useGetCloudMigrationRunQuery,
  useCreateCloudMigrationTokenMutation,
  useGetDashboardByUidQuery,
} = injectedRtkApi;
