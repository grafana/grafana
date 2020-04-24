import React, { FC, useEffect, useState } from 'react';
import Page from 'app/core/components/Page/Page';
import { useAsyncFn } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';
import { Organization, StoreState } from 'app/types';
import { useSelector } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
import { LinkButton, Button, ConfirmModal } from '@grafana/ui';

const getOrgs = async () => {
  return await getBackendSrv().get('/api/orgs');
};

export const AdminListOrgsPage: FC = () => {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const navModel = getNavModel(navIndex, 'global-orgs');

  const [deleteOrg, setDeleteOrg] = useState<Organization>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [, fetchOrgs] = useAsyncFn(getOrgs, []);
  useEffect(() => {
    fetchOrgs().then(res => setOrgs(res));
  }, []);
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <div className="page-action-bar">
          <div className="page-action-bar__spacer"></div>
          <LinkButton href="org/new">New org</LinkButton>
        </div>

        <table className="filter-table form-inline filter-table--hover">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th style={{ width: '1%' }}></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => (
              <tr>
                <td className="link-td">
                  <a href={`admin/orgs/edit/${org.id}`}>{org.id}</a>
                </td>
                <td className="link-td">
                  <a href={`admin/orgs/edit/${org.id}`}>{org.name}</a>
                </td>
                <td className="text-right">
                  <Button icon="times" variant="destructive" onClick={() => setDeleteOrg(org)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deleteOrg && (
          <ConfirmModal
            isOpen
            title="Delete organization"
            confirmText="Delete"
            icon="trash-alt"
            body={
              <>
                <p>Do you want to delete organization {deleteOrg.name}?</p>
                <small>All dashboards for this organization will be removed!</small>
              </>
            }
            onConfirm={async () => {
              setDeleteOrg(null);
              await getBackendSrv().delete('/api/orgs/' + deleteOrg.id);
              fetchOrgs().then(res => setOrgs(res));
            }}
            onDismiss={() => setDeleteOrg(null)}
          />
        )}
      </Page.Contents>
    </Page>
  );
};

export default AdminListOrgsPage;
