import { css } from '@emotion/css';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Badge, useStyles2 } from '@grafana/ui';
import { useGetPublicDashboardQuery } from 'app/features/dashboard/api/publicDashboardApi';

import { ToolbarActionProps } from '../types';

export const PublicDashboardBadge = ({ dashboard }: ToolbarActionProps) => {
  if (!dashboard.state.uid) {
    return null;
  }

  return <PublicDashboardBadgeInternal uid={dashboard.state.uid} />;
};

// Used in old architecture
export const PublicDashboardBadgeLegacy = PublicDashboardBadgeInternal;

function PublicDashboardBadgeInternal({ uid }: { uid: string }) {
  const { data: publicDashboard } = useGetPublicDashboardQuery(uid);
  const styles = useStyles2(getStyles);

  if (!publicDashboard) {
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
