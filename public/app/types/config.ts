import { type CurrentUserDTO } from '@grafana/data';

/**
 * Extends `CurrentUserDTO` with some properties meant only for internal use.
 */
export interface CurrentUserInternal extends CurrentUserDTO {
  hasEditPermissionInFolders: boolean;
  authenticatedBy: string;
}
