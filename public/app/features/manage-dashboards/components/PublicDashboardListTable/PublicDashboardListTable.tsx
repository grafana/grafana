import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useMedia } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime';
import { LinkButton, useStyles2, Spinner, Card, useTheme2, Tooltip, Icon, Switch } from '@grafana/ui/src';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import {
  useListPublicDashboardsQuery,
  useUpdatePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import {
  generatePublicDashboardConfigUrl,
  generatePublicDashboardUrl,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { isOrgAdmin } from 'app/features/plugins/admin/permissions';
import { AccessControlAction } from 'app/types';

import { ListPublicDashboardResponse } from '../../types';

import { DeletePublicDashboardButton } from './DeletePublicDashboardButton';

const PublicDashboardCard = ({ pd }: { pd: ListPublicDashboardResponse }) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);

  const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();

  const selectors = e2eSelectors.pages.PublicDashboards;
  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());
  const isOrphaned = !pd.dashboardUid;

  const onTogglePause = (pd: ListPublicDashboardResponse, isPaused: boolean) => {
    const req = {
      dashboard: { uid: pd.dashboardUid },
      payload: {
        uid: pd.uid,
        isEnabled: !isPaused,
      },
    };

    update(req);
  };

  const CardActions = useMemo(() => (isMobile ? Card.Actions : Card.SecondaryActions), [isMobile]);

  return (
    <Card className={styles.card} href={!isOrphaned ? `/d/${pd.dashboardUid}` : undefined}>
      <Card.Heading className={styles.heading}>
        {!isOrphaned ? (
          <span>{pd.title}</span>
        ) : (
          <Tooltip content="The linked dashboard has already been deleted" placement="top">
            <div className={styles.orphanedTitle}>
              <span>Orphaned public dashboard</span>
              <Icon name="info-circle" />
            </div>
          </Tooltip>
        )}
      </Card.Heading>
      <CardActions className={styles.actions}>
        <div className={styles.pauseSwitch}>
          <Switch
            value={!pd.isEnabled}
            label="Pause sharing"
            disabled={isUpdateLoading}
            onChange={(e) => {
              reportInteraction('grafana_dashboards_public_enable_clicked', {
                action: e.currentTarget.checked ? 'disable' : 'enable',
              });
              onTogglePause(pd, e.currentTarget.checked);
            }}
            data-testid={selectors.ListItem.pauseSwitch}
          />
          <span>Pause sharing</span>
        </div>
        <LinkButton
          disabled={isOrphaned}
          fill="text"
          icon="external-link-alt"
          variant="secondary"
          target="_blank"
          color={theme.colors.warning.text}
          href={generatePublicDashboardUrl(pd.accessToken)}
          key="public-dashboard-url"
          tooltip="View public dashboard"
          data-testid={selectors.ListItem.linkButton}
        />
        <LinkButton
          disabled={isOrphaned}
          fill="text"
          icon="cog"
          variant="secondary"
          color={theme.colors.warning.text}
          href={generatePublicDashboardConfigUrl(pd.dashboardUid)}
          key="public-dashboard-config-url"
          tooltip="Configure public dashboard"
          data-testid={selectors.ListItem.configButton}
        />
        {hasWritePermissions && (
          <DeletePublicDashboardButton
            fill="text"
            icon="power"
            variant="secondary"
            publicDashboard={pd}
            tooltip="Revoke public dashboard url"
            loader={<Spinner />}
            data-testid={selectors.ListItem.trashcanButton}
          />
        )}
      </CardActions>
    </Card>
  );
};

export const PublicDashboardListTable = () => {
  const styles = useStyles2(getStyles);

  const { data: publicDashboards, isLoading, isFetching } = useListPublicDashboardsQuery();

  return (
    <Page navId="dashboards/public" actions={isFetching && <Spinner />}>
      <Page.Contents isLoading={isLoading}>
        <ul className={styles.list}>
          {publicDashboards?.map((pd: ListPublicDashboardResponse) => (
            <li key={pd.uid}>
              <PublicDashboardCard pd={pd} />
            </li>
          ))}
        </ul>
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  list: css`
    list-style-type: none;
  `,
  card: css`
    ${theme.breakpoints.up('sm')} {
      display: flex;
    }
  `,
  heading: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    flex: 1;
  `,
  orphanedTitle: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
  `,
  actions: css`
    display: flex;
    align-items: center;
    position: relative;

    gap: ${theme.spacing(0.5)};
    ${theme.breakpoints.up('sm')} {
      gap: ${theme.spacing(1)};
    }
  `,
  pauseSwitch: css`
    display: flex;
    gap: ${theme.spacing(1)};
    align-items: center;
    font-size: ${theme.typography.bodySmall.fontSize};
    margin-bottom: 0;
    flex: 1;

    ${theme.breakpoints.up('sm')} {
      padding-right: ${theme.spacing(2)};
    }
  `,
});
