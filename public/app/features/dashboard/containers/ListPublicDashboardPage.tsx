import React, { useState, useEffect } from 'react';

import { LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import {
  ListPublicDashboardResponse,
  listPublicDashboards,
  viewPublicDashboardUrl,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboardUtils';

export default function ListPublicDashboardPage() {
  const [publicDashboards, setPublicDashboards] = useState<ListPublicDashboardResponse[]>([]);

  useEffect(() => {
    listPublicDashboards(setPublicDashboards).catch();
  }, []);

  return (
    <Page navId="global-orgs" subTitle="List Grafana Instance Public Dashboards">
      <Page.Contents>
        <>
          <div className="page-action-bar">
            <div className="page-action-bar__spacer" />
          </div>
          <table className="filter-table form-inline filter-table--hover">
            <thead>
              <tr>
                <th>Dashboard Title</th>
                <th>Dashboard Uid</th>
                <th>Access Token</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {console.log(publicDashboards)}
              {publicDashboards.map((pd) => (
                <tr key={pd.uid}>
                  <td>{pd.title}</td>
                  <td>{pd.dashboardUid}</td>
                  <td>{pd.accessToken}</td>
                  <td>
                    <LinkButton size="md" variant="secondary" href={viewPublicDashboardUrl(pd.accessToken)}>
                      View
                    </LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      </Page.Contents>
    </Page>
  );
}
