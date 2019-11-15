import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import appEvents from 'app/core/app_events';
import { RowAction } from './UserProfileRow';
import { UserOrg, CoreEvents } from 'app/types';
import { Modal } from '@grafana/ui';

interface Props {
  orgs: UserOrg[];

  onOrgRemove: (orgId: number) => void;
  onOrgRoleChange: (orgId: number, newRole: string) => void;
}

interface State {
  showAddOrgModal: boolean;
}

export class UserOrgs extends PureComponent<Props, State> {
  state = {
    showAddOrgModal: false,
  };

  handleAddOrg = () => {
    this.setState({ showAddOrgModal: true });
  };

  handleAddOrgModalDismiss = () => {
    this.setState({ showAddOrgModal: false });
  };

  render() {
    const { orgs, onOrgRoleChange, onOrgRemove } = this.props;
    const { showAddOrgModal } = this.state;

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
          <RowAction text="Add this user to another organisation" onClick={this.handleAddOrg} align="left" />
          <AddToOrgModal isOpen={showAddOrgModal} onDismiss={this.handleAddOrgModalDismiss} />
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
    const { org } = this.props;
    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Remove from organisation',
      text: `Are you sure you want to remove user from organisation: ${org.name}?`,
      yesText: 'Remove from organisation',
      icon: 'fa-warning',
      onConfirm: () => {
        this.props.onOrgRemove(org.orgId);
      },
    });
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
              <button className="btn btn-small btn-inverse pull-right" onClick={this.handleOrgRoleSave}>
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

interface AddToOrgModalProps {
  isOpen: boolean;
  onDismiss?: () => void;
}

interface AddToOrgModalState {
  orgName: string;
  role: string;
}

export class AddToOrgModal extends PureComponent<AddToOrgModalProps, AddToOrgModalState> {
  state = {
    orgName: '',
    role: 'Admin',
  };

  handleOrgNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      orgName: event.target.value,
    });
  };

  handleOrgRoleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({
      role: event.target.value,
    });
  };

  handleAddUserToOrg = () => {
    const { orgName, role } = this.state;
    console.log(`Add user to ${orgName} as ${role}`);
  };

  handleCancel = () => {
    this.props.onDismiss();
  };

  render() {
    const { isOpen } = this.props;
    const { orgName, role } = this.state;

    return (
      <Modal title="Add to an organization" isOpen={isOpen} onDismiss={this.handleCancel}>
        <div className="gf-form-group">
          <h6 className="">Organisation's name</h6>
          <span>You can add users only to an already existing organisation</span>
          <div className="gf-form">
            <input type="text" className="gf-form-input width-25" value={orgName} onChange={this.handleOrgNameChange} />
          </div>
        </div>
        <div className="gf-form-group">
          <h6 className="">Role</h6>
          <div className="gf-form-select-wrapper width-8">
            <select value={role} className="gf-form-input" onChange={this.handleOrgRoleChange}>
              {ORG_ROLES.map((option, index) => {
                return (
                  <option value={option} key={`${option}-${index}`}>
                    {option}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <div className="gf-form-button-row">
          <button className="btn btn-inverse" onClick={this.handleCancel}>
            Cancel
          </button>
          <button className="btn btn-secondary" onClick={this.handleAddUserToOrg}>
            Add to organization
          </button>
        </div>
      </Modal>
    );
  }
}
