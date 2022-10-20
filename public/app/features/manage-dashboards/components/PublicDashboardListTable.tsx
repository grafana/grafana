import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useWindowSize } from 'react-use';
import useAsync from 'react-use/lib/useAsync';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Link, ButtonGroup, LinkButton, Icon, Tag, useStyles2, Tooltip, useTheme2 } from '@grafana/ui';
import { getConfig } from 'app/core/config';

import { contextSrv } from '../../../core/services/context_srv';
import { AccessControlAction } from '../../../types';
import { isOrgAdmin } from '../../plugins/admin/permissions';

export interface ListPublicDashboardResponse {
  uid: string;
  accessToken: string;
  dashboardUid: string;
  title: string;
  isEnabled: boolean;
}

export const LIST_PUBLIC_DASHBOARD_URL = `/api/dashboards/public`;
export const getPublicDashboards = async (): Promise<ListPublicDashboardResponse[]> => {
  return getBackendSrv().get(LIST_PUBLIC_DASHBOARD_URL);
};

export const viewPublicDashboardUrl = (accessToken: string): string => {
  return `${getConfig().appUrl}public-dashboards/${accessToken}`;
};

export const ListPublicDashboardTable = () => {
  const { width } = useWindowSize();
  const isMobile = width <= 480;
  const theme = useTheme2();
  const styles = useStyles2(() => getStyles(theme, isMobile));
  const [publicDashboards, setPublicDashboards] = useState<ListPublicDashboardResponse[]>([]);

  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());
  const responsiveSize = isMobile ? 'sm' : 'md';

  useAsync(async () => {
    const publicDashboards = await getPublicDashboards();
    setPublicDashboards(publicDashboards);
  }, [setPublicDashboards]);

  return (
    <div className="page-action-bar">
      <table className="filter-table">
        <thead>
          <tr>
            <th className={styles.nameTh}>Name</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {publicDashboards.map((pd) => (
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
                  >
                    <Icon size={responsiveSize} name="external-link-alt" />
                  </LinkButton>
                  <LinkButton
                    fill="text"
                    size={responsiveSize}
                    href={`/d/${pd.dashboardUid}?shareView=share`}
                    title="Configure public dashboard"
                  >
                    <Icon size={responsiveSize} name="cog" />
                  </LinkButton>
                  {hasWritePermissions && (
                    <LinkButton
                      fill="text"
                      size={responsiveSize}
                      href={`/d/${pd.dashboardUid}?shareView=share`}
                      title="Configure public dashboard"
                    >
                      <Icon size={responsiveSize} name="trash-alt" />
                    </LinkButton>
                  )}
                </ButtonGroup>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2, isMobile: boolean) {
  return {
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
