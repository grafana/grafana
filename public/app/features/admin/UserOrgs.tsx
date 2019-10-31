import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { RowAction } from './UserProfileRow';
import { UserOrg } from 'app/types';

interface Props {
  orgs: UserOrg[];

  onOrgRemove: (orgId: number) => void;
  onOrgRoleChange: (orgId: number, newRole: string) => void;
}

export class UserOrgs extends PureComponent<Props> {
  handleOrgAdd = () => {
    //
  };

  render() {
    const { orgs, onOrgRoleChange, onOrgRemove } = this.props;

    return (
      <>
        <h3 className="page-heading">Organisations</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                {orgs.map((org, index) => (
                  <OrgRow
                    key={`${org.orgId}-${index}`}
                    org={org}
                    onOrgRoleChange={onOrgRoleChange}
                    onOrgRemove={onOrgRemove}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <RowAction text="Add this user to another organisation" onClick={this.handleOrgAdd} />
        </div>
      </>
    );
  }
}

const ORG_ROLES = ['Viewer', 'Editor', 'Admin'];

export interface OrgRowProps {
  org: UserOrg;
  onOrgRemove: (orgId: number) => void;
  onOrgRoleChange: (orgId: number, newRole: string) => void;
}

export interface OrgRowState {
  isEditing: boolean;
  currentRole: string;
}

export class OrgRow extends PureComponent<OrgRowProps, OrgRowState> {
  state = {
    isEditing: false,
    currentRole: this.props.org.role,
  };

  handleOrgRemove = () => {
    this.props.onOrgRemove(this.props.org.orgId);
  };

  handleChangeRoleClick = () => {
    const { org } = this.props;
    this.setState({ isEditing: true, currentRole: org.role });
  };

  handleOrgRoleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = event.target.value;
    this.setState({ currentRole: newRole });
  };

  handleOrgRoleSave = () => {
    this.props.onOrgRoleChange(this.props.org.orgId, this.state.currentRole);
  };

  handleCancelClick = () => {
    this.setState({ isEditing: false });
  };

  render() {
    const { org } = this.props;
    const { isEditing, currentRole } = this.state;
    const labelClass = cx(
      'width-16',
      css`
        font-weight: 500;
      `
    );

    return (
      <tr>
        <td className={labelClass}>{org.name}</td>
        {isEditing ? (
          <>
            <td colSpan={2}>
              <div className="gf-form-select-wrapper width-8">
                <select value={currentRole} className="gf-form-input" onChange={this.handleOrgRoleChange}>
                  {ORG_ROLES.map((option, index) => {
                    return (
                      <option value={option} key={`${option}-${index}`}>
                        {option}
                      </option>
                    );
                  })}
                </select>
              </div>
            </td>
            <td>
              <RowAction text="Cancel" onClick={this.handleCancelClick} />
            </td>
            <td>
              <button className="btn btn-outline-primary pull-right" onClick={this.handleOrgRoleSave}>
                Save
              </button>
            </td>
          </>
        ) : (
          <>
            <td className="width-25" colSpan={2}>
              {org.role}
            </td>
            <td>
              <RowAction text="Change role" onClick={this.handleChangeRoleClick} />
            </td>
            <td>
              <RowAction text="Remove from organisation" onClick={this.handleOrgRemove} />
            </td>
          </>
        )}
      </tr>
    );
  }
}
