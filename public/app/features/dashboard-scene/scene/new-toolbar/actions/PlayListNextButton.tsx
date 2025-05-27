import { selectors } from '@grafana/e2e-selectors';
import { useTranslate } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarActionProps } from '../types';

export const PlayListNextButton = ({}: ToolbarActionProps) => {
  const { t } = useTranslate();

  return (
    <ToolbarButton
      data-testid={selectors.pages.Dashboard.DashNav.playlistControls.next}
      tooltip={t('dashboard.toolbar.new.playlist-next', 'Go to next dashboard')}
      icon="forward"
      onClick={() => playlistSrv.next()}
      narrow
    />
  );
};
