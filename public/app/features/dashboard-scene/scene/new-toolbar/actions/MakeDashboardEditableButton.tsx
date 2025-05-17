import { selectors } from '@grafana/e2e-selectors';
import { Trans, useTranslate } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { ToolbarActionProps } from '../types';

export const MakeDashboardEditableButton = ({ dashboard }: ToolbarActionProps) => {
  const { t } = useTranslate();

  return (
    <Button
      disabled={playlistSrv.state.isPlaying}
      onClick={() => {
        dashboard.onEnterEditMode();
        dashboard.setState({ editable: true, meta: { ...dashboard.state.meta, canEdit: true } });
      }}
      tooltip={t('dashboard.toolbar.new.enter-edit-mode.tooltip', 'This dashboard was marked as read only')}
      variant="secondary"
      size="sm"
      data-testid={selectors.components.NavToolbar.editDashboard.editButton}
    >
      <Trans i18nKey="dashboard.toolbar.new.enter-edit-mode.label">Make editable</Trans>
    </Button>
  );
};
