import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';

import { DashboardInteractions } from '../utils/interactions';

export function CollaborateButton() {
  const location = useLocation();
  const { uid = '' } = useParams();
  const active = new URLSearchParams(location.search).get('comments') === '1';

  if (!config.featureToggles.dashboardComments) {
    return null;
  }

  function enterCollaborateMode() {
    DashboardInteractions.commentsModeEnabled({ dashboard_uid: uid });
    locationService.partial({ comments: '1' });
  }

  function exitCollaborateMode() {
    DashboardInteractions.commentsModeDisabled({ dashboard_uid: uid });
    locationService.partial({ comments: null });
  }

  if (active) {
    return (
      <ToolbarButton
        key="exit-collaborate"
        icon="comment-alt"
        variant="active"
        onClick={exitCollaborateMode}
        tooltip={t('dashboard-scene.comments.exit-collaborate-tooltip', 'Exit collaborate mode')}
      >
        <Trans i18nKey="dashboard-scene.comments.exit-collaborate">Exit collaborate</Trans>
      </ToolbarButton>
    );
  }

  return (
    <ToolbarButton
      key="collaborate"
      icon="comment-alt"
      variant="canvas"
      onClick={enterCollaborateMode}
      tooltip={t('dashboard-scene.comments.collaborate-tooltip', 'Comment and collaborate on this dashboard')}
    >
      <Trans i18nKey="dashboard-scene.comments.collaborate">Collaborate</Trans>
    </ToolbarButton>
  );
}
