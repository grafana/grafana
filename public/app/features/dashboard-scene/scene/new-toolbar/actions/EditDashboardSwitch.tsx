import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { trackDashboardSceneEditButtonClicked } from 'app/features/dashboard/utils/tracking';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarActionProps } from '../types';

import { ToolbarSwitch } from './ToolbarSwitch';

export const EditDashboardSwitch = ({ dashboard }: ToolbarActionProps) => {
  return (
    <ToolbarSwitch
      checked={!!dashboard.state.isEditing}
      icon="pen"
      label={t('dashboard.toolbar.new.edit-toggle.enter.label', 'Enter edit mode')}
      checkedLabel={t('dashboard.toolbar.new.edit-toggle.exit.label', 'Exit edit mode')}
      disabled={playlistSrv.state.isPlaying}
      data-testid={selectors.components.NavToolbar.editDashboard.editButton}
      onClick={(evt) => {
        evt.preventDefault();
        evt.stopPropagation();

        if (!dashboard.state.isEditing) {
          trackDashboardSceneEditButtonClicked();
          dashboard.onEnterEditMode();
        } else {
          dashboard.exitEditMode({ skipConfirm: false });
          DashboardInteractions.exitEditButtonClicked();
        }
      }}
    />
  );
};
