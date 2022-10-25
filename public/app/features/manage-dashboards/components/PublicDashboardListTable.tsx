import { css } from '@emotion/css';
import React, { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Link, ButtonGroup, LinkButton, Icon, Tag, useStyles2 } from '@grafana/ui';
import { getConfig } from 'app/core/config';

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
  const styles = useStyles2(getStyles);
  const [publicDashboards, setPublicDashboards] = useState<ListPublicDashboardResponse[]>([]);

  useAsync(async () => {
    const publicDashboards = await getPublicDashboards();
    setPublicDashboards(publicDashboards);
  }, [setPublicDashboards]);

  return (
    <div className="page-action-bar">
      <table className="filter-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Public URL</th>
            <th>Configuration</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {publicDashboards.map((pd) => (
            <tr key={pd.uid}>
              <td>
                <Link className={styles.link} href={`/d/${pd.dashboardUid}`}>
                  {pd.title}
                </Link>
              </td>
              <td>
                <Tag name={pd.isEnabled ? 'enabled' : 'disabled'} colorIndex={pd.isEnabled ? 20 : 15} />
              </td>
              <td>
                <ButtonGroup>
                  <LinkButton
                    href={viewPublicDashboardUrl(pd.accessToken)}
                    fill="text"
                    title={pd.isEnabled ? 'View public dashboard' : 'Public dashboard is disabled'}
                    target="_blank"
                    disabled={!pd.isEnabled}
                  >
                    <Icon name="external-link-alt" />
                  </LinkButton>
                </ButtonGroup>
              </td>
              <td>
                <ButtonGroup>
                  <LinkButton
                    fill="text"
                    href={`/d/${pd.dashboardUid}?shareView=share`}
                    title="Configure public dashboard"
                  >
                    <Icon name="cog" />
                  </LinkButton>
                </ButtonGroup>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    link: css`
      color: ${theme.colors.primary.text};
      text-decoration: underline;
      margin-right: ${theme.spacing()};
    `,
  };
}
