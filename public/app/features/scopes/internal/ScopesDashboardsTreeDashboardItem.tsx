import { css } from '@emotion/css';
import { Link } from 'react-router-dom';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { SuggestedDashboard } from './types';

export interface ScopesDashboardsTreeDashboardItemProps {
  dashboard: SuggestedDashboard;
}

export function ScopesDashboardsTreeDashboardItem({ dashboard }: ScopesDashboardsTreeDashboardItemProps) {
  const styles = useStyles2(getStyles);

  const [queryParams] = useQueryParams();

  return (
    <Link
      key={dashboard.dashboard}
      to={urlUtil.renderUrl(`/d/${dashboard.dashboard}/`, queryParams)}
      className={styles.container}
      data-testid={`scopes-dashboards-${dashboard.dashboard}`}
      role="treeitem"
    >
      <Icon name="apps" /> {dashboard.dashboardTitle}
    </Link>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0),

      '&:last-child': css({
        paddingBottom: 0,
      }),
    }),
  };
};
