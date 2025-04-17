import { selectors } from '@grafana/e2e-selectors';
import { ToolbarButton } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarActionProps } from '../types';

export const PlayListStopButton = ({}: ToolbarActionProps) => (
  <ToolbarButton
    onClick={() => playlistSrv.stop()}
    data-testid={selectors.pages.Dashboard.DashNav.playlistControls.stop}
  >
    <Trans i18nKey="dashboard.toolbar.new.playlist-stop">Stop playlist</Trans>
  </ToolbarButton>
);
