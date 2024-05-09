// @todo: replace barrel import path
import { PermissionLevelString } from '../../../../types/index';

export type PermissionLevel = Exclude<PermissionLevelString, PermissionLevelString.Admin>;
