import { css } from '@emotion/css';

import { selectors } from '@grafana/e2e-selectors';
import { Badge, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ToolbarActionProps } from '../types';

export const PublicDashboardBadge = ({}: ToolbarActionProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Badge
      color="blue"
      text={t('dashboard.toolbar.new.public-dashboard', 'Public')}
      className={styles.badge}
      data-testid={selectors.pages.Dashboard.DashNav.publicDashboardTag}
    />
  );
};

const getStyles = () => ({
  badge: css({
    color: 'grey',
    backgroundColor: 'transparent',
    border: '1px solid',
  }),
});
