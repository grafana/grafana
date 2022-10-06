import { css } from '@emotion/css';
import React, { FC, useState } from 'react';
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

export const listPublicDashboardsUrl = () => {
  return `/api/dashboards/public`;
};
export const getPublicDashboards = async () => {
  const resp: ListPublicDashboardResponse[] = await getBackendSrv().get(listPublicDashboardsUrl());
  return resp.sort((a, b) => Number(b.isEnabled) - Number(a.isEnabled));
};

export const viewPublicDashboardUrl = (accessToken: string): string => {
  return `${getConfig().appUrl}public-dashboards/${accessToken}`;
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

export const ListPublicDashboardTable = () => {
  const styles = useStyles2(getStyles);
  const [publicDashboards, setPublicDashboards] = useState<ListPublicDashboardResponse[]>([]);

  useAsync(async () => {
    const publicDashboards = await getPublicDashboards();
    setPublicDashboards(publicDashboards);
  }, [setPublicDashboards]);

  function renderEnabledTag(pd: ListPublicDashboardResponse) {
return pd.isEnabled ? <Tag name="enabled" colorIndex={20} /> : <Tag name="disabled" colorIndex={15} />;
  }

  function renderViewLink(pd: ListPublicDashboardResponse) {
    let title = pd.isEnabled ? 'View public dashboard' : 'Public dashboard is disabled';
    return (
      <LinkButton
        href={viewPublicDashboardUrl(pd.accessToken)}
        fill="text"
        title={title}
        target="_blank"
        disabled={!pd.isEnabled}
      >
        <Icon name="external-link-alt" />
      </LinkButton>
    );
  }

  function renderConfigLink(pd: ListPublicDashboardResponse) {
    let url = `/d/${pd.dashboardUid}?shareView=share`;
    return (
      <LinkButton fill="text" href={url} title="Configure public dashboard">
        <Icon name="cog" />
      </LinkButton>
    );
  }

  return (
    <div className="page-action-bar">
      <table className="filter-table">
        <thead>
          <tr>
            <th>Dashboard</th>
            <th>Public dashboard Enabled</th>
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
              <td>{renderEnabledTag(pd)}</td>
              <td>
                <ButtonGroup>
                  {renderViewLink(pd)}
                  {renderConfigLink(pd)}
                </ButtonGroup>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
