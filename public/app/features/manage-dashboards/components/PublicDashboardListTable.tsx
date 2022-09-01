import { css } from '@emotion/css';
import React, { FC, useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Link, Switch, ClipboardButton, useStyles2 } from '@grafana/ui';
import {
  ListPublicDashboardResponse,
  listPublicDashboards,
  generatePublicDashboardUrl,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboardUtils';

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

  function togglePublicDashboard() {}

  function publicDashboardLinks(pd: ListPublicDashboardResponse) {
    if (pd.isEnabled) {
      return (
        <>
          <Link className={styles.link} href={generatePublicDashboardUrl(pd.accessToken)}>
            /public-dashboards/{pd.accessToken}
          </Link>
          <ClipboardButton
            size="sm"
            variant="primary"
            icon="copy"
            getText={() => {
              return generatePublicDashboardUrl(pd.accessToken);
            }}
          >
            Copy
          </ClipboardButton>
        </>
      );
    } else {
      return (
        <Link className={styles.link} href={generatePublicDashboardUrl(pd.accessToken)}>
          /public-dashboards/{pd.accessToken}
        </Link>
      );
    }
  }

  return (
    <div className="page-action-bar">
      <table className="filter-table">
        <thead>
          <tr>
            <th>Dashboard</th>
            <th>Public Dashboard Url</th>
            <th>Enabled</th>
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
              <td>{publicDashboardLinks(pd)}</td>
              <td style={{ lineHeight: '20px' }}>
                <Switch value={pd.isEnabled} onChange={togglePublicDashboard} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
