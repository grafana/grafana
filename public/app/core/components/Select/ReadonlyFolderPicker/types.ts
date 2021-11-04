import { PermissionLevelString } from '../../../../types';

export type PermissionLevel = Exclude<PermissionLevelString, PermissionLevelString.Admin>;
