import React, { FC, useEffect } from 'react';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types/store';
import { LinkButton, InfoBox, Badge, VerticalGroup } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
import { AdminOrgsTable } from './AdminOrgsTable';
import useAsyncFn from 'react-use/lib/useAsyncFn';

const deleteOrg = async (orgId: number) => {
  return await getBackendSrv().delete('/api/orgs/' + orgId);
};

const getOrgs = async () => {
  return await getBackendSrv().get('/api/orgs');
};

export const AdminListOrgsPages: FC = () => {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const navModel = getNavModel(navIndex, 'global-orgs');
  const [state, fetchOrgs] = useAsyncFn(async () => await getOrgs(), []);
  useEffect(() => {
    fetchOrgs();
  }, []);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <>
          <div className="page-action-bar">
            <InfoBox branded>
              <VerticalGroup spacing="xs">
                <Badge text="Info" color="blue" icon="info-circle" />
                <p>
                  Organizations is a feature that only 1% of Grafana users are utilizing, and we feel that most of those
                  users would have a better experience using Teams instead. As such, we are considering de-emphasizing
                  and eventually deprecating Organizations in future Grafana releases. If you would like to provide
                  feedback or describe your use case, please do so{' '}
                  <a className="external-link" href="https://github.com/grafana/grafana/issues/xxx">
                    here
                  </a>
                  .
                </p>
              </VerticalGroup>
            </InfoBox>

            <div className="page-action-bar__spacer"></div>
            <LinkButton icon="plus" href="org/new">
              New org
            </LinkButton>
          </div>
          {state.loading && 'Fetching organizations'}
          {state.error}
          {state.value && (
            <AdminOrgsTable
              orgs={state.value}
              onDelete={orgId => {
                deleteOrg(orgId);
                fetchOrgs();
              }}
            />
          )}
        </>
      </Page.Contents>
    </Page>
  );
};

export default AdminListOrgsPages;
