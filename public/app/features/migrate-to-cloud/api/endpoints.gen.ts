import { baseAPI as api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSessionList: build.query<GetSessionListApiResponse, GetSessionListApiArg>({
      query: () => ({ url: `/cloudmigration/migration` }),
    }),
    createSession: build.mutation<CreateSessionApiResponse, CreateSessionApiArg>({
      query: (queryArg) => ({
        url: `/cloudmigration/migration`,
        method: 'POST',
        body: queryArg.cloudMigrationSessionRequestDto,
      }),
    }),
    deleteSession: build.mutation<DeleteSessionApiResponse, DeleteSessionApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.uid}`, method: 'DELETE' }),
    }),
    getSession: build.query<GetSessionApiResponse, GetSessionApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.uid}` }),
    }),
    createSnapshot: build.mutation<CreateSnapshotApiResponse, CreateSnapshotApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.uid}/snapshot`, method: 'POST' }),
    }),
    getSnapshot: build.query<GetSnapshotApiResponse, GetSnapshotApiArg>({
      query: (queryArg) => ({
        url: `/cloudmigration/migration/${queryArg.uid}/snapshot/${queryArg.snapshotUid}`,
        params: { resultPage: queryArg.resultPage, resultLimit: queryArg.resultLimit },
      }),
    }),
    cancelSnapshot: build.mutation<CancelSnapshotApiResponse, CancelSnapshotApiArg>({
      query: (queryArg) => ({
        url: `/cloudmigration/migration/${queryArg.uid}/snapshot/${queryArg.snapshotUid}/cancel`,
        method: 'POST',
      }),
    }),
    uploadSnapshot: build.mutation<UploadSnapshotApiResponse, UploadSnapshotApiArg>({
      query: (queryArg) => ({
        url: `/cloudmigration/migration/${queryArg.uid}/snapshot/${queryArg.snapshotUid}/upload`,
        method: 'POST',
      }),
    }),
    getShapshotList: build.query<GetShapshotListApiResponse, GetShapshotListApiArg>({
      query: (queryArg) => ({
        url: `/cloudmigration/migration/${queryArg.uid}/snapshots`,
        params: { page: queryArg.page, limit: queryArg.limit, sort: queryArg.sort },
      }),
    }),
    getCloudMigrationToken: build.query<GetCloudMigrationTokenApiResponse, GetCloudMigrationTokenApiArg>({
      query: () => ({ url: `/cloudmigration/token` }),
    }),
    createCloudMigrationToken: build.mutation<CreateCloudMigrationTokenApiResponse, CreateCloudMigrationTokenApiArg>({
      query: () => ({ url: `/cloudmigration/token`, method: 'POST' }),
    }),
    deleteCloudMigrationToken: build.mutation<DeleteCloudMigrationTokenApiResponse, DeleteCloudMigrationTokenApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/token/${queryArg.uid}`, method: 'DELETE' }),
    }),
    getDashboardByUid: build.query<GetDashboardByUidApiResponse, GetDashboardByUidApiArg>({
      query: (queryArg) => ({ url: `/dashboards/uid/${queryArg.uid}` }),
    }),
    getLibraryElementByUid: build.query<GetLibraryElementByUidApiResponse, GetLibraryElementByUidApiArg>({
      query: (queryArg) => ({ url: `/library-elements/${queryArg.libraryElementUid}` }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedAPI };
export type GetSessionListApiResponse = /** status 200 (empty) */ CloudMigrationSessionListResponseDto;
export type GetSessionListApiArg = void;
export type CreateSessionApiResponse = /** status 200 (empty) */ CloudMigrationSessionResponseDto;
export type CreateSessionApiArg = {
  cloudMigrationSessionRequestDto: CloudMigrationSessionRequestDto;
};
export type DeleteSessionApiResponse = unknown;
export type DeleteSessionApiArg = {
  /** UID of a migration session */
  uid: string;
};
export type GetSessionApiResponse = /** status 200 (empty) */ CloudMigrationSessionResponseDto;
export type GetSessionApiArg = {
  /** UID of a migration session */
  uid: string;
};
export type CreateSnapshotApiResponse = /** status 200 (empty) */ CreateSnapshotResponseDto;
export type CreateSnapshotApiArg = {
  /** UID of a session */
  uid: string;
};
export type GetSnapshotApiResponse = /** status 200 (empty) */ GetSnapshotResponseDto;
export type GetSnapshotApiArg = {
  /** ResultPage is used for pagination with ResultLimit */
  resultPage?: number;
  /** Max limit for snapshot results returned. */
  resultLimit?: number;
  /** Session UID of a session */
  uid: string;
  /** UID of a snapshot */
  snapshotUid: string;
};
export type CancelSnapshotApiResponse = /** status 200 (empty) */ void;
export type CancelSnapshotApiArg = {
  /** Session UID of a session */
  uid: string;
  /** UID of a snapshot */
  snapshotUid: string;
};
export type UploadSnapshotApiResponse = /** status 200 (empty) */ void;
export type UploadSnapshotApiArg = {
  /** Session UID of a session */
  uid: string;
  /** UID of a snapshot */
  snapshotUid: string;
};
export type GetShapshotListApiResponse = /** status 200 (empty) */ SnapshotListResponseDto;
export type GetShapshotListApiArg = {
  /** Page is used for pagination with limit */
  page?: number;
  /** Max limit for results returned. */
  limit?: number;
  /** Session UID of a session */
  uid: string;
  /** Sort with value latest to return results sorted in descending order. */
  sort?: string;
};
export type GetCloudMigrationTokenApiResponse = /** status 200 (empty) */ GetAccessTokenResponseDto;
export type GetCloudMigrationTokenApiArg = void;
export type CreateCloudMigrationTokenApiResponse = /** status 200 (empty) */ CreateAccessTokenResponseDto;
export type CreateCloudMigrationTokenApiArg = void;
export type DeleteCloudMigrationTokenApiResponse = /** status 204 (empty) */ void;
export type DeleteCloudMigrationTokenApiArg = {
  /** UID of a cloud migration token */
  uid: string;
};
export type GetDashboardByUidApiResponse = /** status 200 (empty) */ DashboardFullWithMeta;
export type GetDashboardByUidApiArg = {
  uid: string;
};
export type GetLibraryElementByUidApiResponse =
  /** status 200 (empty) */ LibraryElementResponseIsAResponseStructForLibraryElementDto;
export type GetLibraryElementByUidApiArg = {
  libraryElementUid: string;
};
export type CloudMigrationSessionResponseDto = {
  created?: string;
  slug?: string;
  uid?: string;
  updated?: string;
};
export type CloudMigrationSessionListResponseDto = {
  sessions?: CloudMigrationSessionResponseDto[];
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
export type CloudMigrationSessionRequestDto = {
  authToken?: string;
};
export type CreateSnapshotResponseDto = {
  uid?: string;
};
export type MigrateDataResponseItemDto = {
  message?: string;
  name?: string;
  refId: string;
  status: 'OK' | 'WARNING' | 'ERROR' | 'PENDING' | 'UNKNOWN';
  type: 'DASHBOARD' | 'DATASOURCE' | 'FOLDER' | 'LIBRARY_ELEMENT';
};
export type SnapshotResourceStats = {
  statuses?: {
    [key: string]: number;
  };
  total?: number;
  types?: {
    [key: string]: number;
  };
};
export type GetSnapshotResponseDto = {
  created?: string;
  finished?: string;
  results?: MigrateDataResponseItemDto[];
  sessionUid?: string;
  stats?: SnapshotResourceStats;
  status?:
    | 'INITIALIZING'
    | 'CREATING'
    | 'PENDING_UPLOAD'
    | 'UPLOADING'
    | 'PENDING_PROCESSING'
    | 'PROCESSING'
    | 'FINISHED'
    | 'CANCELED'
    | 'ERROR'
    | 'UNKNOWN';
  uid?: string;
};
export type SnapshotDto = {
  created?: string;
  finished?: string;
  sessionUid?: string;
  status?:
    | 'INITIALIZING'
    | 'CREATING'
    | 'PENDING_UPLOAD'
    | 'UPLOADING'
    | 'PENDING_PROCESSING'
    | 'PROCESSING'
    | 'FINISHED'
    | 'CANCELED'
    | 'ERROR'
    | 'UNKNOWN';
  uid?: string;
};
export type SnapshotListResponseDto = {
  snapshots?: SnapshotDto[];
};
export type GetAccessTokenResponseDto = {
  createdAt?: string;
  displayName?: string;
  expiresAt?: string;
  firstUsedAt?: string;
  id?: string;
  lastUsedAt?: string;
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
export type LibraryElementDtoMetaUserDefinesModelForLibraryElementDtoMetaUser = {
  avatarUrl?: string;
  id?: number;
  name?: string;
};
export type LibraryElementDtoMetaIsTheMetaInformationForLibraryElementDto = {
  connectedDashboards?: number;
  created?: string;
  createdBy?: LibraryElementDtoMetaUserDefinesModelForLibraryElementDtoMetaUser;
  folderName?: string;
  folderUid?: string;
  updated?: string;
  updatedBy?: LibraryElementDtoMetaUserDefinesModelForLibraryElementDtoMetaUser;
};
export type LibraryElementDtoIsTheFrontendDtoForEntities = {
  description?: string;
  /** Deprecated: use FolderUID instead */
  folderId?: number;
  folderUid?: string;
  id?: number;
  kind?: number;
  meta?: LibraryElementDtoMetaIsTheMetaInformationForLibraryElementDto;
  model?: object;
  name?: string;
  orgId?: number;
  schemaVersion?: number;
  type?: string;
  uid?: string;
  version?: number;
};
export type LibraryElementResponseIsAResponseStructForLibraryElementDto = {
  result?: LibraryElementDtoIsTheFrontendDtoForEntities;
};
export const {
  useGetSessionListQuery,
  useCreateSessionMutation,
  useDeleteSessionMutation,
  useGetSessionQuery,
  useCreateSnapshotMutation,
  useGetSnapshotQuery,
  useCancelSnapshotMutation,
  useUploadSnapshotMutation,
  useGetShapshotListQuery,
  useGetCloudMigrationTokenQuery,
  useCreateCloudMigrationTokenMutation,
  useDeleteCloudMigrationTokenMutation,
  useGetDashboardByUidQuery,
  useGetLibraryElementByUidQuery,
} = injectedRtkApi;
