import { css } from '@emotion/css';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useFlagDashboardsPublicDashboardBadgeFromApi } from '@grafana/runtime/internal';
import { Badge, useStyles2 } from '@grafana/ui';
import { useGetPublicDashboardQuery } from 'app/features/dashboard/api/publicDashboardApi';

import { type ToolbarActionProps } from '../types';

export const PublicDashboardBadge = ({ dashboard }: ToolbarActionProps) => {
  if (!dashboard.state.uid || !config.publicDashboardsEnabled) {
    return null;
  }

  return (
    <PublicDashboardBadgeInternal
      uid={dashboard.state.uid}
      hasPublicDashboard={dashboard.state.meta.publicDashboardEnabled}
    />
  );
};

function PublicDashboardBadgeInternal({ uid, hasPublicDashboard }: { uid: string; hasPublicDashboard?: boolean }) {
  // When enabled, always call the public dashboard API to check if the dashboard is a public dashboard
  // and decouple the usage of `meta.publicDashboardEnabled`
  const fromApi = useFlagDashboardsPublicDashboardBadgeFromApi();

  const { data: publicDashboard, isError } = useGetPublicDashboardQuery(uid, {
    skip: !fromApi && hasPublicDashboard !== undefined && !hasPublicDashboard,
  });
  const styles = useStyles2(getStyles);

  // RTK Query keeps the last successful data after a failed refetch.
  const isPublicInApi = !isError && !!publicDashboard;
  let showBadge: boolean;
  if (fromApi) {
    showBadge = isPublicInApi;
  } else {
    showBadge = hasPublicDashboard !== undefined ? hasPublicDashboard : isPublicInApi;
  }

  if (!showBadge) {
    return null;
  }

  return (
    <Badge
      color="blue"
      text={t('dashboard.toolbar.new.public-dashboard', 'Public')}
      className={styles.badge}
      data-testid={selectors.pages.Dashboard.DashNav.publicDashboardTag}
    />
  );
}

const getStyles = () => ({
  badge: css({
    color: 'grey',
    backgroundColor: 'transparent',
    border: '1px solid',
  }),
});
