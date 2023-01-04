import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { dateTimeFormat } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

const subTitle = (
  <span>
    Support bundles allow you to easily collect and share Grafana logs, configuration, and data with the Grafana Labs
    team.
  </span>
);

type SupportBundleState = 'complete' | 'error' | 'timeout' | 'pending';

interface SupportBundle {
  uid: string;
  state: SupportBundleState;
  creator: string;
  createdAt: number;
  expiresAt: number;
}

const getBundles = () => {
  return getBackendSrv().get<SupportBundle[]>('/api/support-bundles');
};

function SupportBundles() {
  const [bundlesState, fetchBundles] = useAsyncFn(getBundles, []);

  useEffect(() => {
    fetchBundles();
  }, [fetchBundles]);

  return (
    <Page navId="support-bundles" subTitle={subTitle}>
      <Page.Contents isLoading={bundlesState.loading}>
        <LinkButton href="admin/support-bundles/create" variant="primary">
          Create New Support Bundle
        </LinkButton>

        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th>Date</th>
              <th>Requested by</th>
              <th>Expires</th>
              <th style={{ width: '1%' }} />
            </tr>
          </thead>
          <tbody>
            {bundlesState?.value?.map((b) => (
              <tr key={b.uid}>
                <th>{dateTimeFormat(b.createdAt * 1000)}</th>
                <th>{b.creator}</th>
                <th>{dateTimeFormat(b.expiresAt * 1000)}</th>
                <th>
                  <LinkButton disabled={b.state !== 'complete'} target={'_self'} href={'/api/support-bundles/' + b.uid}>
                    Download
                  </LinkButton>
                </th>
              </tr>
            ))}
          </tbody>
        </table>
      </Page.Contents>
    </Page>
  );
}

export default SupportBundles;
