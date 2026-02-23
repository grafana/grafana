import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';
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
