import React, { PureComponent } from 'react';
import { UserDTO, UserOrg } from 'app/types';
import { Button, LoadingPlaceholder } from '@grafana/ui';

export interface Props {
  user: UserDTO | null;
  orgs: UserOrg[];
  isLoading: boolean;
  setUserOrg: (org: UserOrg) => void;
}

export class UserOrganizations extends PureComponent<Props> {
  render() {
    const { isLoading, orgs, user } = this.props;

    if (isLoading) {
      return <LoadingPlaceholder text="Loading organizations..." />;
    }

    if (orgs.length === 0) {
      return null;
    }

    return (
      <div>
        <h3 className="page-sub-heading">Organizations</h3>
        <div className="gf-form-group">
          <table className="filter-table form-inline" aria-label="User organizations table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orgs.map((org: UserOrg, index) => {
                return (
                  <tr key={index}>
                    <td>{org.name}</td>
                    <td>{org.role}</td>
                    <td className="text-right">
                      {org.orgId === user?.orgId ? (
                        <Button variant="secondary" size="sm" disabled>
                          Current
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            this.props.setUserOrg(org);
                          }}
                        >
                          Select
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default UserOrganizations;
