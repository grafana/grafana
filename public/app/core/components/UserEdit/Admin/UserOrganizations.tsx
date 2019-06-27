import React, { PureComponent } from 'react';
import _ from 'lodash';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { getBackendSrv } from '@grafana/runtime';
import { StoreState, OrgUser } from 'app/types';
import { FormLabel, Select, Button } from '@grafana/ui';
import { OrganizationPicker, OrgOption } from 'app/core/components/Select/OrganizationPicker';

export interface RoleOption {
  value: string;
  label: string;
}

export interface UserOrg {
  orgId: number;
  name: string;
  role: string;
}

export interface Props {
  userId: number;
  user: OrgUser;
}

export interface State {
  newOrg: OrgOption;
  newOrgRole: string;
  roles: RoleOption[];
  userOrgs: UserOrg[];
}

export class UserOrganizations extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      newOrg: {} as OrgOption,
      newOrgRole: 'Editor',
      roles: [
        {
          label: 'Viewer',
          value: 'Viewer',
        },
        {
          label: 'Editor',
          value: 'Editor',
        },
        {
          label: 'Admin',
          value: 'Admin',
        },
      ],
      userOrgs: [],
    };
  }

  async componentDidMount() {
    await this.loadUserOrgs();
  }

  onRoleSelect = (newOrgRole: string) => {
    this.setState({ newOrgRole });
  };

  onOrgSelect = (org: OrgOption) => {
    this.setState({ newOrg: org });
  };

  async onOrgRoleChange(userOrg: UserOrg, newRole: string) {
    const { userId } = this.props;
    userOrg.role = newRole;
    await getBackendSrv().patch('/api/orgs/' + userOrg.orgId + '/users/' + userId, userOrg);
    await this.loadUserOrgs();
  }

  async onAddToOrg() {
    const { user } = this.props;
    const { newOrg, newOrgRole } = this.state;
    await getBackendSrv().post('/api/orgs/' + newOrg.id + '/users/', {
      loginOrEmail: user.login,
      name: newOrg.label,
      role: newOrgRole,
    });
    await this.loadUserOrgs();
  }

  async removeFromOrg(UserOrg: { orgId: number }) {
    const { userId } = this.props;
    await getBackendSrv().delete('/api/orgs/' + UserOrg.orgId + '/users/' + userId);
    await this.loadUserOrgs();
  }

  async loadUserOrgs() {
    const { userId } = this.props;
    const userOrgs = await getBackendSrv().get('/api/users/' + userId + '/orgs');
    this.setState({ userOrgs });
  }

  render() {
    const { user } = this.props;
    const { newOrgRole, roles, userOrgs } = this.state;
    return (
      <>
        <h3 className="page-heading">Organizations</h3>
        <form name="addOrgForm" className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel>Add</FormLabel>
              <OrganizationPicker className="max-width-20" onSelected={this.onOrgSelect} />
            </div>
            <div className="gf-form">
              <FormLabel>Role</FormLabel>
              <Select
                inputId="role-picker"
                className="width-10"
                value={roles.find(role => role.value === newOrgRole)}
                options={roles}
                onChange={role => this.onRoleSelect(role.value)}
              />
            </div>
            <div className="gf-form">
              <Button
                onClick={event => {
                  event.preventDefault();
                  this.onAddToOrg();
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </form>
        <div className="gf-form-group">
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {userOrgs.map((userOrg: UserOrg, index) => {
                return (
                  <tr key={index}>
                    <td>
                      {userOrg.name} {userOrg.orgId === user.orgId && <span className="label label-info">Current</span>}
                    </td>
                    <td>
                      <Select
                        inputId={userOrg.orgId + '-role-picker'}
                        className="width-10"
                        value={roles.find(role => role.value === userOrg.role)}
                        options={roles}
                        onChange={role => this.onOrgRoleChange(userOrg, role.value)}
                      />
                    </td>
                    <td>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          this.removeFromOrg(userOrg);
                        }}
                      >
                        <i className="fa fa-remove" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    user: state.user.profile,
  };
}

const mapDispatchToProps = {};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserOrganizations)
);
