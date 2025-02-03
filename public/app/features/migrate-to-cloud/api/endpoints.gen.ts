import { baseAPI as api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSessionList: build.query<GetSessionListApiResponse, GetSessionListApiArg>({
      query: () => ({ url: `/cloudmigration/migration` }),
    }),
    createSession: build.mutation<CreateSessionApiResponse, CreateSessionApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration`, method: 'POST', body: queryArg.body }),
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
        params: {
          resultPage: queryArg.resultPage,
          resultLimit: queryArg.resultLimit,
        },
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
        params: {
          page: queryArg.page,
          limit: queryArg.limit,
          sort: queryArg.sort,
        },
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
export type GetSessionListApiResponse = unknown;
export type GetSessionListApiArg = void;
export type CreateSessionApiResponse = unknown;
export type CreateSessionApiArg = {
  body: any;
};
export type DeleteSessionApiResponse = unknown;
export type DeleteSessionApiArg = {
  /** UID of a migration session */
  uid: string;
};
export type GetSessionApiResponse = unknown;
export type GetSessionApiArg = {
  /** UID of a migration session */
  uid: string;
};
export type CreateSnapshotApiResponse = unknown;
export type CreateSnapshotApiArg = {
  /** UID of a session */
  uid: string;
};
export type GetSnapshotApiResponse = unknown;
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
export type CancelSnapshotApiResponse = unknown;
export type CancelSnapshotApiArg = {
  /** Session UID of a session */
  uid: string;
  /** UID of a snapshot */
  snapshotUid: string;
};
export type UploadSnapshotApiResponse = unknown;
export type UploadSnapshotApiArg = {
  /** Session UID of a session */
  uid: string;
  /** UID of a snapshot */
  snapshotUid: string;
};
export type GetShapshotListApiResponse = unknown;
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
export type GetCloudMigrationTokenApiResponse = unknown;
export type GetCloudMigrationTokenApiArg = void;
export type CreateCloudMigrationTokenApiResponse = unknown;
export type CreateCloudMigrationTokenApiArg = void;
export type DeleteCloudMigrationTokenApiResponse = unknown;
export type DeleteCloudMigrationTokenApiArg = {
  /** UID of a cloud migration token */
  uid: string;
};
export type GetDashboardByUidApiResponse = unknown;
export type GetDashboardByUidApiArg = {
  uid: string;
};
export type GetLibraryElementByUidApiResponse = unknown;
export type GetLibraryElementByUidApiArg = {
  libraryElementUid: string;
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
