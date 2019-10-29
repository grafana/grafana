import React, { PureComponent } from 'react';
import { UserProfileRow } from './UserProfileRow';
import { UserOrg } from 'app/types';

interface Props {
  orgs: UserOrg[];

  onOrgRemove: (orgId: number) => void;
  onOrgRoleChange: (orgId: number, newRole: string) => void;
}

export class UserOrgs extends PureComponent<Props> {
  handleOrgRemove = (orgId: number) => () => {
    this.props.onOrgRemove(orgId);
  };

  handleOrgRoleChange = (orgId: number, newRole: string) => () => {
    this.props.onOrgRoleChange(orgId, newRole);
  };

  render() {
    const { orgs } = this.props;

    return (
      <>
        <h3 className="page-heading">Organizations</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                {orgs.map((org, index) => (
                  <UserProfileRow key={`${org.orgId}-${index}`} label={org.name} value={org.role} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }
}
