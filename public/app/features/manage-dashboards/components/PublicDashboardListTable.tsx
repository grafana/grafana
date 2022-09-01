import React, { FC, useState, useEffect } from 'react';

import { LinkButton, Link, Switch, Icon, ClipboardButton } from '@grafana/ui';
import {
  ListPublicDashboardResponse,
  listPublicDashboards,
  generatePublicDashboardUrl,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboardUtils';

export const PublicDashboardListTable: FC = () => {
  const [publicDashboards, setPublicDashboards] = useState<ListPublicDashboardResponse[]>([]);

  useEffect(() => {
    listPublicDashboards(setPublicDashboards).catch();
  }, []);

  function publicDashboardLinks(pd: ListPublicDashboardResponse) {
    if (pd.isEnabled) {
      return (
        <>
          <Link href={generatePublicDashboardUrl(pd.accessToken)}>/public-dashboards/{pd.accessToken}</Link>
          <ClipboardButton
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
      return <Link href={generatePublicDashboardUrl(pd.accessToken)}>/public-dashboards/{pd.accessToken}</Link>;
    }
  }

  return (
    <div className="page-action-bar">
      <table className="filter-table form-inline filter-table--hover">
        <thead>
          <tr>
            <th>Dashboard Title</th>
            <th>Dashboard Uid</th>
            <th>Url</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {publicDashboards.map((pd) => (
            <tr key={pd.uid}>
              <td>
                <LinkButton size="sm" href={`/d/${pd.dashboardUid}`}>
                  <Icon size="sm" name="arrow-up" />
                </LinkButton>{' '}
                {pd.title}
              </td>
              <td>{pd.dashboardUid}</td>
              <td>{publicDashboardLinks(pd)}</td>
              <td>
                <Switch value={pd.isEnabled} disabled={false} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
