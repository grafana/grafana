import { selectors } from '@grafana/e2e-selectors';
import { ToolbarButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarActionProps } from '../types';

export const PlayListNextButton = ({}: ToolbarActionProps) => (
  <ToolbarButton
    data-testid={selectors.pages.Dashboard.DashNav.playlistControls.next}
    tooltip={t('dashboard.toolbar.new.playlist-next', 'Go to next dashboard')}
    icon="forward"
    onClick={() => playlistSrv.next()}
    narrow
  />
);
