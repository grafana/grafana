import { type Api, type MutationDefinition, type QueryDefinition } from '@reduxjs/toolkit/query';

type UserEndpoint =
  | 'getUserById'
  | 'getUserOrgList'
  | 'getUserTeams'
  | 'updateUser'
  | 'adminGetUserAuthTokens'
  | 'adminDeleteUser'
  | 'adminDisableUser'
  | 'adminEnableUser'
  | 'adminLogoutUser'
  | 'adminUpdateUserPassword'
  | 'adminUpdateUserPermissions'
  | 'adminRevokeUserAuthToken'
  | 'removeOrgUser'
  | 'updateOrgUser';

type UserIdArg<Arg> = Arg extends { userId: number } ? Omit<Arg, 'userId'> & { userId: number | string } : Arg;

type UserIdDefinition<Definition> =
  Definition extends QueryDefinition<infer Arg, infer BaseQuery, infer Tags, infer Result, infer Path>
    ? QueryDefinition<UserIdArg<Arg>, BaseQuery, Tags, Result, Path>
    : Definition extends MutationDefinition<infer Arg, infer BaseQuery, infer Tags, infer Result, infer Path>
      ? MutationDefinition<UserIdArg<Arg>, BaseQuery, Tags, Result, Path>
      : Definition;

// These legacy routes accept UIDs as well as numeric IDs. RTK Query's enhanceEndpoints
// can override responses, but preserves the generated argument types.
export type WithUserUIDs<Client> =
  Client extends Api<infer BaseQuery, infer Definitions, infer Path, infer Tags, infer Modules>
    ? Api<
        BaseQuery,
        {
          [Key in keyof Definitions]: Key extends UserEndpoint ? UserIdDefinition<Definitions[Key]> : Definitions[Key];
        },
        Path,
        Tags,
        Modules
      >
    : never;
