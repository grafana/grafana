import { selectors } from '@grafana/e2e-selectors';
import { Button, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarActionProps } from '../types';
import { getCommonActionStyles } from '../utils';

export const MakeDashboardEditableButton = ({ dashboard }: ToolbarActionProps) => {
  const styles = useStyles2(getCommonActionStyles);

  return (
    <Button
      disabled={playlistSrv.state.isPlaying}
      onClick={() => {
        dashboard.onEnterEditMode();
        dashboard.setState({ editable: true, meta: { ...dashboard.state.meta, canEdit: true } });
      }}
      tooltip={t('dashboard.toolbar.enter-edit-mode.tooltip', 'This dashboard was marked as read only')}
      className={styles.buttonWithExtraMargin}
      variant="secondary"
      size="sm"
      data-testid={selectors.components.NavToolbar.editDashboard.editButton}
    >
      <Trans i18nKey="dashboard.toolbar.enter-edit-mode.label">Make editable</Trans>
    </Button>
  );
};
