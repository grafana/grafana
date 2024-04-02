import { baseAPI as api } from './baseAPI';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getMigrationList: build.query<GetMigrationListApiResponse, GetMigrationListApiArg>({
      query: () => ({ url: `/cloudmigration/migration` }),
    }),
    createMigration: build.mutation<CreateMigrationApiResponse, CreateMigrationApiArg>({
      query: (queryArg) => ({
        url: `/cloudmigration/migration`,
        method: 'POST',
        params: { authToken: queryArg.authToken },
      }),
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
    getCloudMigrationRun: build.query<GetCloudMigrationRunApiResponse, GetCloudMigrationRunApiArg>({
      query: (queryArg) => ({ url: `/cloudmigration/migration/${queryArg.id}/run/${queryArg.runId}` }),
    }),
    createCloudMigrationToken: build.mutation<CreateCloudMigrationTokenApiResponse, CreateCloudMigrationTokenApiArg>({
      query: () => ({ url: `/cloudmigration/token`, method: 'POST' }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as enhancedApi };
export type GetMigrationListApiResponse = /** status 200 (empty) */ CloudMigrationListResponse;
export type GetMigrationListApiArg = void;
export type CreateMigrationApiResponse = /** status 200 (empty) */ CloudMigrationResponse;
export type CreateMigrationApiArg = {
  authToken?: string;
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
export type GetCloudMigrationRunApiResponse = /** status 200 (empty) */ CloudMigrationRun;
export type GetCloudMigrationRunApiArg = {
  /** ID of an migration */
  id: number;
  /** Run ID of a migration run */
  runId: number;
};
export type CreateCloudMigrationTokenApiResponse = /** status 200 (empty) */ CreateAccessTokenResponseDto;
export type CreateCloudMigrationTokenApiArg = void;
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
export type MigratedResourceResult = {
  message?: string;
  status?: string;
};
export type MigratedResource = {
  id?: string;
  name?: string;
  refID?: string;
  result?: MigratedResourceResult;
  type?: string;
};
export type MigrationResult = {
  message?: string;
  status?: string;
};
export type CloudMigrationRun = {
  created?: string;
  finished?: string;
  id?: number;
  items?: MigratedResource[];
  result?: MigrationResult;
  uid?: string;
  updated?: string;
};
export type CloudMigrationRunList = {
  runs?: CloudMigrationRun[];
};
export type CreateAccessTokenResponseDto = {
  token?: string;
};
export const {
  useGetMigrationListQuery,
  useCreateMigrationMutation,
  useDeleteCloudMigrationMutation,
  useGetCloudMigrationQuery,
  useGetCloudMigrationRunListQuery,
  useGetCloudMigrationRunQuery,
  useCreateCloudMigrationTokenMutation,
} = injectedRtkApi;
