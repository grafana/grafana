import { css, keyframes } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, HorizontalGroup, Spinner, useStyles2, VerticalGroup } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { DashboardInitPhase } from 'app/types';

export interface Props {
  initPhase: DashboardInitPhase;
}

export const DashboardLoading = ({ initPhase }: Props) => {
  const styles = useStyles2(getStyles);
  const cancelVariables = () => {
    locationService.push('/');
  };

  return (
    <div className={styles.dashboardLoading}>
      <div className={styles.dashboardLoadingText}>
        <VerticalGroup spacing="md">
          <HorizontalGroup align="center" justify="center" spacing="xs">
            <Spinner inline={true} /> {initPhase}
          </HorizontalGroup>{' '}
          <HorizontalGroup align="center" justify="center">
            <Button variant="secondary" size="md" icon="repeat" onClick={cancelVariables}>
              <Trans i18nKey="dashboard.dashboard-loading.cancel-loading-dashboard">Cancel loading dashboard</Trans>
            </Button>
          </HorizontalGroup>
        </VerticalGroup>
      </div>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  // Amount of time we want to pass before we start showing loading spinner
  const slowStartThreshold = '0.5s';

  const invisibleToVisible = keyframes`
    0% { opacity: 0%; }
    100% { opacity: 100%; }
  `;

  return {
    dashboardLoading: css({
      height: '60vh',
      display: 'flex',
      opacity: '0%',
      alignItems: 'center',
      justifyContent: 'center',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${invisibleToVisible} 0s step-end ${slowStartThreshold} 1 normal forwards`,
      },
    }),
    dashboardLoadingText: css({
      fontSize: theme.typography.h4.fontSize,
    }),
  };
};
