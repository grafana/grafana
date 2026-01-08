import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarActionProps } from '../types';

export const PlayListPreviousButton = ({}: ToolbarActionProps) => {
  return (
    <ToolbarButton
      data-testid={selectors.pages.Dashboard.DashNav.playlistControls.prev}
      tooltip={t('dashboard.toolbar.new.playlist-previous', 'Go to previous dashboard')}
      icon="backward"
      onClick={() => playlistSrv.prev()}
    />
  );
};
