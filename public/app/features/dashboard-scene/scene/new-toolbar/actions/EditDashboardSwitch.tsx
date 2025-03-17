import { selectors } from '@grafana/e2e-selectors';
import { t } from 'app/core/internationalization';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarSwitch } from '../ToolbarSwitch';
import { ToolbarActionProps } from '../types';

export const EditDashboardSwitch = ({ dashboard }: ToolbarActionProps) => (
  <ToolbarSwitch
    icon="pen"
    label={
      dashboard.state.isEditing
        ? t('dashboard.toolbar.new.edit-toggle.exit.label', 'Exit edit mode')
        : t('dashboard.toolbar.new.edit-toggle.enter.label', 'Enter edit mode')
    }
    checked={!!dashboard.state.isEditing}
    disabled={playlistSrv.state.isPlaying}
    variant="blue"
    data-testid={selectors.components.NavToolbar.editDashboard.editButton}
    onClick={(evt) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!dashboard.state.isEditing) {
        dashboard.onEnterEditMode();
      } else {
        dashboard.exitEditMode({ skipConfirm: false });
      }
    }}
  />
);
