import React from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { UserOrgDTO } from '@grafana/data';
import { Modal, Button } from '@grafana/ui';

import { contextSrv } from 'app/core/services/context_srv';
import config from 'app/core/config';

interface Props {
  onDismiss: () => void;
}

interface State {
  orgs: UserOrgDTO[];
}

export class OrgSwitcher extends React.PureComponent<Props, State> {
  state: State = {
    orgs: [],
  };

  componentDidMount() {
    this.getUserOrgs();
  }

  getUserOrgs = async () => {
    const orgs: UserOrgDTO[] = await getBackendSrv().get('/api/user/orgs');
    this.setState({
      orgs: orgs.sort((a, b) => a.orgId - b.orgId),
    });
  };

  setCurrentOrg = async (org: UserOrgDTO) => {
    await getBackendSrv().post(`/api/user/using/${org.orgId}`);
    this.setWindowLocation(`${config.appSubUrl}${config.appSubUrl.endsWith('/') ? '' : '/'}?orgId=${org.orgId}`);
  };

  setWindowLocation(href: string) {
    window.location.href = href;
  }

  render() {
    const { onDismiss } = this.props;
    const { orgs } = this.state;

    const currentOrgId = contextSrv.user.orgId;

    return (
      <Modal title="Switch Organization" icon="random" onDismiss={onDismiss} isOpen={true}>
        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => (
              <tr key={org.orgId}>
                <td>{org.name}</td>
                <td>{org.role}</td>
                <td className="text-right">
                  {org.orgId === currentOrgId ? (
                    <Button size="sm">Current</Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => this.setCurrentOrg(org)}>
                      Switch to
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>
    );
  }
}
