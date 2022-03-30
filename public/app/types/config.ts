import { CurrentUserDTO } from '@grafana/data';

/**
 * Extends `CurrentUserDTO` with some properties meant only for internal use.
 */
export interface CurrentUserInternal extends CurrentUserDTO {
  helpFlags1: number;
  hasEditPermissionInFolders: boolean;
}
