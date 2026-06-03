import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { Trans } from '@grafana/i18n';
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

  function toggle() {
    if (active) {
      DashboardInteractions.commentsModeDisabled({ dashboard_uid: uid });
      locationService.partial({ comments: null });
    } else {
      DashboardInteractions.commentsModeEnabled({ dashboard_uid: uid });
      locationService.partial({ comments: '1' });
    }
  }

  return (
    <ToolbarButton icon="comment-alt" variant={active ? 'active' : 'default'} onClick={toggle}>
      <Trans i18nKey="dashboard-scene.comments.collaborate">Collaborate</Trans>
    </ToolbarButton>
  );
}
