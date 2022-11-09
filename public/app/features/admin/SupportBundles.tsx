import React from 'react';

import { Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

function SupportBundles() {
  return (
    <Page navId="support-bundles">
      <Page.Contents>
        <div className="grafana-info-box span8" style={{ margin: '20px 0 25px 0' }}>
          Support bundles allow you to easily collect and share Grafana logs, configuration, and data with the Grafana
          Labs team.
        </div>

        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th>Date</th>
              <th>Requested by</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>2022-11-10 12h04</th>
              <th>jguer</th>
              <th>2022-11-11 12h04</th>
              <th>
                <Button variant="secondary">Download</Button>
              </th>
            </tr>
            <tr>
              <th>2022-12-10 14h21</th>
              <th>kallee</th>
              <th>2022-12-11 14h21</th>
              <th>
                <Button variant="secondary">Download</Button>
              </th>
            </tr>
          </tbody>
        </table>

        <Button variant="primary">Create New Support Bundle</Button>
      </Page.Contents>
    </Page>
  );
}

export default SupportBundles;
