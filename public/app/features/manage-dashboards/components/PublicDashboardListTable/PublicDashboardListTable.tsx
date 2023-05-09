import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { LinkButton, Icon, Tag, useStyles2, Tooltip, Spinner, Card } from '@grafana/ui/src';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { useListPublicDashboardsQuery } from 'app/features/dashboard/api/publicDashboardApi';
import {
  generatePublicDashboardConfigUrl,
  generatePublicDashboardUrl,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { isOrgAdmin } from 'app/features/plugins/admin/permissions';
import { AccessControlAction } from 'app/types';

import { ListPublicDashboardResponse } from '../../types';

import { DeletePublicDashboardButton } from './DeletePublicDashboardButton';

export const PublicDashboardListTable = () => {
  const styles = useStyles2(getStyles);

  const { data: publicDashboards, isLoading, isFetching } = useListPublicDashboardsQuery();

  const selectors = e2eSelectors.pages.PublicDashboards;
  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());

  return (
    <Page navId="dashboards/public" actions={isFetching && <Spinner />}>
      <Page.Contents isLoading={isLoading}>
        <ul className={styles.list}>
          {publicDashboards?.map((pd: ListPublicDashboardResponse) => {
            const isOrphaned = !pd.dashboardUid;
            return (
              <li key={pd.uid}>
                <Card>
                  <Card.Heading>
                    <div className={styles.heading}>
                      <Tooltip
                        content={!isOrphaned ? pd.title : 'The linked dashboard has already been deleted'}
                        placement="top"
                      >
                        {!isOrphaned ? (
                          <span>{pd.title}</span>
                        ) : (
                          <div className={styles.orphanedTitle}>
                            <span>Orphaned public dashboard</span>
                            <Icon name="info-circle" />
                          </div>
                        )}
                      </Tooltip>
                      <LinkButton
                        tooltip="View dashboard"
                        disabled={isOrphaned}
                        icon="external-link-alt"
                        fill="text"
                        href={`/d/${pd.dashboardUid}`}
                      />
                    </div>
                  </Card.Heading>
                  <Card.Tags>
                    <Tag
                      name={pd.isEnabled ? 'enabled' : 'paused'}
                      colorIndex={isOrphaned ? 9 : pd.isEnabled ? 20 : 15}
                    />
                  </Card.Tags>
                  <Card.Actions>
                    <LinkButton
                      href={generatePublicDashboardUrl(pd.accessToken)}
                      fill="solid"
                      title={pd.isEnabled ? 'View public dashboard' : 'Public dashboard is disabled'}
                      target="_blank"
                      disabled={isOrphaned}
                      data-testid={selectors.ListItem.linkButton}
                    >
                      View public dashboard
                    </LinkButton>
                    <LinkButton
                      variant="secondary"
                      icon="cog"
                      href={generatePublicDashboardConfigUrl(pd.dashboardUid)}
                      title="Configure public dashboard"
                      disabled={isOrphaned}
                      data-testid={selectors.ListItem.configButton}
                    >
                      Settings
                    </LinkButton>
                    {hasWritePermissions && (
                      <DeletePublicDashboardButton
                        variant="destructive"
                        data-testid={selectors.ListItem.trashcanButton}
                        publicDashboard={pd}
                        icon="trash-alt"
                        loader={<Spinner />}
                      >
                        Revoke public URL
                      </DeletePublicDashboardButton>
                    )}
                  </Card.Actions>
                </Card>
              </li>
            );
          })}
        </ul>
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  list: css`
    list-style-type: none;
  `,
  heading: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
  `,
  orphanedTitle: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
  `,
});
