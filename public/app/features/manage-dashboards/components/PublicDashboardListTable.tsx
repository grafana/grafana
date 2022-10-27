import { css } from '@emotion/css';
import React from 'react';
import { useWindowSize } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Link, ButtonGroup, LinkButton, Icon, Tag, useStyles2, Tooltip, useTheme2, Spinner } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getConfig } from 'app/core/config';

import { contextSrv } from '../../../core/services/context_srv';
import { AccessControlAction } from '../../../types';
import { useGetPublicDashboardsQuery } from '../../dashboard/api/publicDashboardApi';
import { isOrgAdmin } from '../../plugins/admin/permissions';

import { DeletePublicDashboardButton } from './DeletePublicDashboard/DeletePublicDashboardButton';

export const viewPublicDashboardUrl = (accessToken: string): string =>
  `${getConfig().appUrl}public-dashboards/${accessToken}`;

export const PublicDashboardListTable = () => {
  const { width } = useWindowSize();
  const isMobile = width <= 480;
  const theme = useTheme2();
  const styles = useStyles2(() => getStyles(theme, isMobile));

  const { data: publicDashboards, isLoading, isFetching } = useGetPublicDashboardsQuery();

  const selectors = e2eSelectors.pages.PublicDashboards;
  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());
  const responsiveSize = isMobile ? 'sm' : 'md';

  return (
    <Page.Contents isLoading={isLoading}>
      <div className="page-action-bar">
        <table className="filter-table">
          <thead>
            <tr>
              <th className={styles.nameTh}>Name</th>
              <th>Status</th>
              <th className={styles.fetchingSpinner}>{isFetching && <Spinner />}</th>
            </tr>
          </thead>
          <tbody>
            {publicDashboards?.map((pd) => (
              <tr key={pd.uid}>
                <td className={styles.titleTd}>
                  <Tooltip content={pd.title} placement="top">
                    <Link className={styles.link} href={`/d/${pd.dashboardUid}`}>
                      {pd.title}
                    </Link>
                  </Tooltip>
                </td>
                <td>
                  <Tag name={pd.isEnabled ? 'enabled' : 'disabled'} colorIndex={pd.isEnabled ? 20 : 15} />
                </td>
                <td>
                  <ButtonGroup className={styles.buttonGroup}>
                    <LinkButton
                      href={viewPublicDashboardUrl(pd.accessToken)}
                      fill="text"
                      size={responsiveSize}
                      title={pd.isEnabled ? 'View public dashboard' : 'Public dashboard is disabled'}
                      target="_blank"
                      disabled={!pd.isEnabled}
                      data-testid={selectors.ListItem.linkButton}
                    >
                      <Icon size={responsiveSize} name="external-link-alt" />
                    </LinkButton>
                    <LinkButton
                      fill="text"
                      size={responsiveSize}
                      href={`/d/${pd.dashboardUid}?shareView=share`}
                      title="Configure public dashboard"
                      data-testid={selectors.ListItem.configButton}
                    >
                      <Icon size={responsiveSize} name="cog" />
                    </LinkButton>
                    {hasWritePermissions && <DeletePublicDashboardButton publicDashboard={pd} size={responsiveSize} />}
                  </ButtonGroup>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page.Contents>
  );
};

function getStyles(theme: GrafanaTheme2, isMobile: boolean) {
  return {
    fetchingSpinner: css`
      display: flex;
      justify-content: end;
    `,
    link: css`
      color: ${theme.colors.primary.text};
      text-decoration: underline;
      margin-right: ${theme.spacing()};
    `,
    nameTh: css`
      width: 20%;
    `,
    titleTd: css`
      max-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `,
    buttonGroup: css`
      justify-content: ${isMobile ? 'space-between' : 'end'};
    `,
  };
}
