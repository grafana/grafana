import { selectors } from '@grafana/e2e-selectors';
import { useTranslate } from '@grafana/i18n';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarActionProps } from '../types';

import { ToolbarSwitch } from './ToolbarSwitch';

export const EditDashboardSwitch = ({ dashboard }: ToolbarActionProps) => {
  const { t } = useTranslate();

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
          dashboard.onEnterEditMode();
        } else {
          dashboard.exitEditMode({ skipConfirm: false });
        }
      }}
    />
  );
};
