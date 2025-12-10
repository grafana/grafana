import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { trackDashboardSceneEditButtonClicked } from 'app/features/dashboard-scene/utils/tracking';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarActionProps } from '../types';

export const EditDashboardSwitch = ({ dashboard }: ToolbarActionProps) => {
  const tooltip = dashboard.state.isEditing
    ? t('dashboard.toolbar.edit-button.exit-tooltip', 'Exit edit mode')
    : t('dashboard.toolbar.edit-button.enter-tooltip', 'Enter edit mode');

  if (playlistSrv.state.isPlaying) {
    return null;
  }

  return (
    <Button
      tooltip={tooltip}
      data-testid={selectors.components.NavToolbar.editDashboard.editButton}
      variant="secondary"
      onClick={(evt) => {
        evt.preventDefault();
        evt.stopPropagation();

        if (!dashboard.state.isEditing) {
          trackDashboardSceneEditButtonClicked(dashboard.state.uid);
          dashboard.onEnterEditMode();
        } else {
          DashboardInteractions.exitEditButtonClicked();
          dashboard.exitEditMode({ skipConfirm: false });
        }
      }}
    >
      {dashboard.state.isEditing
        ? t('dashboard.toolbar.edit-button.exit', 'Exit edit')
        : t('dashboard.toolbar.edit-button.enter', 'Edit')}
    </Button>
  );
};
