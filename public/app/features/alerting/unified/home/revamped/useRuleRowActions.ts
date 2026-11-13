import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { useFolder } from '../../hooks/useFolder';
import { getRulesPermissions } from '../../utils/access-control';

/**
 * What the user may do with a rule from its row: silence it and edit it, each checked against the rule's
 * folder. A rule is silenced with the global instance permission or the folder's silence permission, and
 * edited with the folder's rule update permission. Nothing else is checked, so a provisioned rule can show
 * Edit and refuse it on the editor page.
 */
export function useRuleRowActions(folderUid?: string): { canSilence: boolean; canEdit: boolean } {
  const { folder } = useFolder(folderUid);

  const canSilence =
    contextSrv.hasPermission(AccessControlAction.AlertingInstanceCreate) ||
    (folder?.accessControl?.[AccessControlAction.AlertingSilenceCreate] ?? false);
  const canEdit = folder ? contextSrv.hasPermissionInMetadata(getRulesPermissions('grafana').update, folder) : false;

  return { canSilence, canEdit };
}
