import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Stack, useStyles2 } from '@grafana/ui';
import impressionSrv from 'app/core/services/impression_srv';
import { type DashboardQueryResult } from 'app/features/search/service/types';

import { clearHistoryClicked } from '../analytics/main';

interface Props {
  dashboards: DashboardQueryResult[];
  redesignEnabled?: boolean;
  retry: () => void;
}

export function RecentDashboardsClearButton({ dashboards, retry, redesignEnabled }: Props) {
  const styles = useStyles2(getStyles);

  if (dashboards.length === 0) {
    return null;
  }

  const handleClearHistory = () => {
    clearHistoryClicked({ dashboard_count: dashboards.length });
    impressionSrv.clearImpressions();
    retry();
  };

  return (
    <>
      {redesignEnabled ? (
        <Stack justifyContent="flex-end" wrap="wrap">
          <Button size="sm" fill="text" onClick={handleClearHistory}>
            <Trans i18nKey="home.recent-dashboards-tab.reset">Reset recent dashboards</Trans>
          </Button>
        </Stack>
      ) : (
        <div className={styles.clearButton}>
          <Button icon="times" size="sm" variant="secondary" fill="text" onClick={handleClearHistory}>
            <Trans i18nKey="home.recent-dashboards-tab.clear">Clear history</Trans>
          </Button>
        </div>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  clearButton: css({
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(1),
    marginTop: 'auto',

    svg: {
      position: 'relative',
      top: 0.5,
    },
  }),
});
