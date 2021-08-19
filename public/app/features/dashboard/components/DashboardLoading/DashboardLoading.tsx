import React from 'react';
import { css } from 'emotion';
import { Button, HorizontalGroup, Spinner, useStyles, VerticalGroup } from '@grafana/ui';
import { locationService } from '@grafana/runtime';
import { GrafanaTheme } from '@grafana/data';
import { DashboardInitPhase } from 'app/types';

export interface Props {
  initPhase: DashboardInitPhase;
}

export const DashboardLoading = ({ initPhase }: Props) => {
  const styles = useStyles(getStyles);
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
              Cancel loading dashboard
            </Button>
          </HorizontalGroup>
        </VerticalGroup>
      </div>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme) => {
  return {
    dashboardLoading: css`
      height: 60vh;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    dashboardLoadingText: css`
      font-size: ${theme.typography.size.lg};
    `,
  };
};
