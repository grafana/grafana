import { reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { type DashboardScene } from '../scene/DashboardScene';

export function getDashboardSaveActions(dashboard: DashboardScene, templatesEnabled: boolean) {
  const { meta, uid } = dashboard.state;
  const isManaged = dashboard.isManaged();
  const isNew = !Boolean(uid || isManaged);
  const isTemplate = templatesEnabled && Boolean(meta.isDashboardTemplate);
  const copyOnly =
    !isNew &&
    !isTemplate &&
    contextSrv.hasEditPermissionInFolders &&
    !meta.canSave &&
    !meta.canMakeEditable &&
    !isManaged;
  const canSave =
    Boolean(meta.canSave || contextSrv.hasEditPermissionInFolders) && (!isTemplate || Boolean(meta.canSave));

  const saveAsCopy = () => {
    reportInteraction('grafana_dashboard_save_as_copy_clicked');
    return dashboard.openSaveDrawer({ saveAsCopy: true });
  };

  const save = () => {
    if (isTemplate) {
      return dashboard.openSaveDrawer({ saveDashboardTemplate: true });
    }
    if (copyOnly) {
      return saveAsCopy();
    }
    return dashboard.openSaveDrawer({});
  };

  return { save, saveAsCopy, isNew, isTemplate, copyOnly, canSave };
}
