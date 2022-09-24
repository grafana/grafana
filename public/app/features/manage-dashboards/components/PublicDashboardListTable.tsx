import { css } from '@emotion/css';
import React, { FC, useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Link,
  //Switch,
  //HorizontalGroup,
  //ClipboardButton,
  //InlineLabel,
  //LinkButton,
  Icon,
  Tag,
  useStyles2,
} from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { generatePublicDashboardUrl } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

export interface ListPublicDashboardResponse {
  uid: string;
  accessToken: string;
  dashboardUid: string;
  title: string;
  isEnabled: boolean;
}

export const listPublicDashboards = async (
  setPublicDashboards: React.Dispatch<React.SetStateAction<ListPublicDashboardResponse[]>>
) => {
  const resp: ListPublicDashboardResponse[] = await getBackendSrv().get(listPublicDashboardsUrl());
  setPublicDashboards(resp.sort((a, b) => Number(b.isEnabled) - Number(a.isEnabled)));
};

export const listPublicDashboardsUrl = () => {
  return `/api/dashboards/public`;
};

//describe('listPublicDashboardsUrl', () => {
//it('has the correct url', () => {
//expect(listPublicDashboardsUrl()).toEqual('/api/dashboards/public');
//});
//});

function getStyles(theme: GrafanaTheme2) {
  return {
    link: css`
      color: ${theme.colors.primary.text};
      text-decoration: underline;
      margin-right: ${theme.spacing()};
    `,
  };
}

export const PublicDashboardListTable: FC = () => {
  const styles = useStyles2(getStyles);
  const [publicDashboards, setPublicDashboards] = useState<ListPublicDashboardResponse[]>([]);

  useEffect(() => {
    listPublicDashboards(setPublicDashboards).catch();
  }, []);

  //function togglePublicDashboard() {}

  //function publicDashboardLinks(pd: ListPublicDashboardResponse) {
  //if (pd.isEnabled) {
  //return (
  //<>

  //<HorizontalGroup justify="flex-end">
  //<LinkButton href={generatePublicDashboardUrl(pd.accessToken)}>
  //<Icon  name="external-link-alt" size="sm" />
  //</LinkButton>

  //<ClipboardButton
  //size="xs"
  //variant="primary"
  //icon="copy"
  //getText={() => {
  //return generatePublicDashboardUrl(pd.accessToken);
  //}}
  //>
  //Copy
  //</ClipboardButton>
  //</HorizontalGroup>
  //</>
  //);
  //} else {
  //return (
  //<Link className={styles.link} href={generatePublicDashboardUrl(pd.accessToken)}>
  ///public-dashboards/{pd.accessToken}
  //</Link>
  //);
  //}
  //}

  function renderEnabledTag(pd: ListPublicDashboardResponse) {
    let label = pd.isEnabled ? 'enabled' : 'disabled';
    let color = pd.isEnabled ? 20 : 15; // 20 = green /  15 = red
    return <Tag name={label} colorIndex={color} />;
  }

  function renderViewLink(pd: ListPublicDashboardResponse) {
    let url = pd.isEnabled ? generatePublicDashboardUrl(pd.accessToken) : '#';
    let title = pd.isEnabled ? 'View public dashboard' : 'Public dashboard is disabled';
    //let pointerEnabled = pd.isEnabled ? "auto" : "none"
    return (
      <Link href={url} style={{ display: 'inline' }} title={title} target="_blank">
        <Icon name="external-link-alt" />
      </Link>
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
                <Link className={styles.link} href={`/d/${pd.dashboardUid}`} target="_blank">
                  {pd.title}
                </Link>
              </td>
              <td>{renderEnabledTag(pd)}</td>
              <td>
                {renderViewLink(pd)}
                &nbsp; &nbsp;
                <Link
                  href={generatePublicDashboardUrl(pd.accessToken)}
                  style={{ display: 'inline' }}
                  title="Disable public dashboard"
                >
                  <Icon name="eye-slash" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
