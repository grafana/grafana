import { css } from '@emotion/css';
import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ConfirmModal, useStyles2 } from '@grafana/ui';
import { SkeletonComponent, attachSkeleton } from '@grafana/ui/src/unstable';
import { contextSrv } from 'app/core/core';
import { Trans } from 'app/core/internationalization';
import { AccessControlAction, Organization } from 'app/types';

interface Props {
  orgs: Organization[];
  onDelete: (orgId: number) => void;
}

const getTableHeader = () => (
  <thead>
    <tr>
      <th>
        <Trans i18nKey="admin.orgs.id-header">ID</Trans>
      </th>
      <th>
        <Trans i18nKey="admin.orgs.name-header">Name</Trans>
      </th>
      <th style={{ width: '1%' }}></th>
    </tr>
  </thead>
);

function AdminOrgsTableComponent({ orgs, onDelete }: Props) {
  const canDeleteOrgs = contextSrv.hasPermission(AccessControlAction.OrgsDelete);

  const [deleteOrg, setDeleteOrg] = useState<Organization>();
  const deleteOrgName = deleteOrg?.name;
  return (
    <table className="filter-table form-inline filter-table--hover">
      {getTableHeader()}
      <tbody>
        {orgs.map((org) => (
          <tr key={`${org.id}-${org.name}`}>
            <td className="link-td">
              <a href={`admin/orgs/edit/${org.id}`}>{org.id}</a>
            </td>
            <td className="link-td">
              <a href={`admin/orgs/edit/${org.id}`}>{org.name}</a>
            </td>
            <td className="text-right">
              <Button
                variant="destructive"
                size="sm"
                icon="times"
                onClick={() => setDeleteOrg(org)}
                aria-label="Delete org"
                disabled={!canDeleteOrgs}
              />
            </td>
          </tr>
        ))}
      </tbody>
      {deleteOrg && (
        <ConfirmModal
          isOpen
          icon="trash-alt"
          title="Delete"
          body={
            <div>
              <Trans i18nKey="admin.orgs.delete-body">
                Are you sure you want to delete &apos;{{ deleteOrgName }}&apos;?
                <br /> <small>All dashboards for this organization will be removed!</small>
              </Trans>
            </div>
          }
          confirmText="Delete"
          onDismiss={() => setDeleteOrg(undefined)}
          onConfirm={() => {
            onDelete(deleteOrg.id);
            setDeleteOrg(undefined);
          }}
        />
      )}
    </table>
  );
}

const AdminOrgsTableSkeleton: SkeletonComponent = ({ rootProps }) => {
  const styles = useStyles2(getSkeletonStyles);
  return (
    <table className="filter-table" {...rootProps}>
      {getTableHeader()}
      <tbody>
        {new Array(3).fill(null).map((_, index) => (
          <tr key={index}>
            <td>
              <Skeleton width={16} />
            </td>
            <td>
              <Skeleton width={240} />
            </td>
            <td>
              <Skeleton containerClassName={styles.deleteButton} width={22} height={24} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const AdminOrgsTable = attachSkeleton(AdminOrgsTableComponent, AdminOrgsTableSkeleton);

const getSkeletonStyles = (theme: GrafanaTheme2) => ({
  deleteButton: css({
    alignItems: 'center',
    display: 'flex',
    height: 30,
    lineHeight: 1,
  }),
});
