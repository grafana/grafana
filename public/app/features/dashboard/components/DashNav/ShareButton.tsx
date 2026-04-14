import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { shareDashboardType } from '../ShareModal/utils';

export const ShareButton = ({ dashboard }: { dashboard: DashboardModel }) => {
  return (
    <ToolbarButton
      tooltip={t('dashboard.toolbar.share', 'Share dashboard')}
      icon="share-alt"
      data-testid={e2eSelectors.pages.Dashboard.DashNav.shareButton}
      onClick={() => {
        DashboardInteractions.toolbarShareClick();
        locationService.partial({ shareView: shareDashboardType.link });
      }}
    >
      <Trans i18nKey="dashboard.toolbar.share-button">Share</Trans>
    </ToolbarButton>
  );
};
