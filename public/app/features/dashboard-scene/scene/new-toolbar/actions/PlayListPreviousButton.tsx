import { selectors } from '@grafana/e2e-selectors';
import { ToolbarButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarActionProps } from '../types';

export const PlayListPreviousButton = ({}: ToolbarActionProps) => (
  <ToolbarButton
    data-testid={selectors.pages.Dashboard.DashNav.playlistControls.prev}
    tooltip={t('dashboard.toolbar.new.playlist-previous', 'Go to previous dashboard')}
    icon="backward"
    onClick={() => playlistSrv.prev()}
  />
);
