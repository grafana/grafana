import { css } from '@emotion/css';
import React, { ReactElement } from 'react';
import { useAsync } from 'react-use';

import { UserOrgDTO } from '@grafana/data';
import { Button, CustomScrollbar, Modal } from '@grafana/ui';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';

import { api } from '../../features/profile/api';

interface Props {
  onDismiss: () => void;
}

export function OrgSwitcher({ onDismiss }: Props): ReactElement {
  const { value: orgs = [] } = useAsync(() => {
    return api.loadOrgs();
  }, []);
  const currentOrgId = contextSrv.user.orgId;
  const contentClassName = css({
    display: 'flex',
    maxHeight: 'calc(85vh - 42px)',
  });
  const setCurrentOrg = async (org: UserOrgDTO) => {
    await api.setUserOrg(org);
    window.location.href = `${config.appSubUrl}${config.appSubUrl.endsWith('/') ? '' : '/'}?orgId=${org.orgId}`;
  };

  return (
    <Modal
      title="Switch Organization"
      icon="arrow-random"
      onDismiss={onDismiss}
      isOpen={true}
      contentClassName={contentClassName}
    >
      <CustomScrollbar autoHeightMin="100%">
        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.orgId}>
                <td>{org.name}</td>
                <td>{org.role}</td>
                <td className="text-right">
                  {org.orgId === currentOrgId ? (
                    <Button size="sm">Current</Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setCurrentOrg(org)}>
                      Switch to
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CustomScrollbar>
    </Modal>
  );
}
