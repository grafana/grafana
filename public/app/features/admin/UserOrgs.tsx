import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { Modal, Themeable, stylesFactory, withTheme, ConfirmButton, Forms } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { UserOrg, Organization } from 'app/types';
import { OrgPicker, OrgSelectItem } from 'app/core/components/Select/OrgPicker';

interface Props {
  orgs: UserOrg[];

  onOrgRemove: (orgId: number) => void;
  onOrgRoleChange: (orgId: number, newRole: string) => void;
  onOrgAdd: (orgId: number, role: string) => void;
}

interface State {
  showAddOrgModal: boolean;
}

export class UserOrgs extends PureComponent<Props, State> {
  state = {
    showAddOrgModal: false,
  };

  showOrgAddModal = (show: boolean) => () => {
    this.setState({ showAddOrgModal: show });
  };

  render() {
    const { orgs, onOrgRoleChange, onOrgRemove, onOrgAdd } = this.props;
    const { showAddOrgModal } = this.state;
    const addToOrgContainerClass = css`
      margin-top: 0.8rem;
    `;

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
          <div className={addToOrgContainerClass}>
            <Forms.Button variant="secondary" onClick={this.showOrgAddModal(true)}>
              Add user to organization
            </Forms.Button>
          </div>
          <AddToOrgModal isOpen={showAddOrgModal} onOrgAdd={onOrgAdd} onDismiss={this.showOrgAddModal(false)} />
        </div>
      </>
    );
  }
}

const ORG_ROLES = ['Viewer', 'Editor', 'Admin'];

const getOrgRowStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    removeButton: css`
      margin-right: 0.6rem;
      text-decoration: underline;
      color: ${theme.colors.blue95};
    `,
    label: css`
      font-weight: 500;
    `,
  };
});

interface OrgRowProps extends Themeable {
  org: UserOrg;
  onOrgRemove: (orgId: number) => void;
  onOrgRoleChange: (orgId: number, newRole: string) => void;
}

interface OrgRowState {
  currentRole: string;
  isChangingRole: boolean;
  isRemovingFromOrg: boolean;
}

class UnThemedOrgRow extends PureComponent<OrgRowProps, OrgRowState> {
  state = {
    currentRole: this.props.org.role,
    isChangingRole: false,
    isRemovingFromOrg: false,
  };

  onOrgRemove = () => {
    const { org } = this.props;
    this.props.onOrgRemove(org.orgId);
  };

  onChangeRoleClick = () => {
    const { org } = this.props;
    this.setState({ isChangingRole: true, currentRole: org.role });
  };

  onOrgRemoveClick = () => {
    this.setState({ isRemovingFromOrg: true });
  };

  onOrgRoleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = event.target.value;
    this.setState({ currentRole: newRole });
  };

  onOrgRoleSave = () => {
    this.props.onOrgRoleChange(this.props.org.orgId, this.state.currentRole);
  };

  onCancelClick = () => {
    this.setState({ isChangingRole: false, isRemovingFromOrg: false });
  };

  render() {
    const { org, theme } = this.props;
    const { currentRole, isChangingRole, isRemovingFromOrg } = this.state;
    const styles = getOrgRowStyles(theme);
    const labelClass = cx('width-16', styles.label);

    return (
      <tr>
        <td className={labelClass}>{org.name}</td>
        {isChangingRole ? (
          <td>
            <div className="gf-form-select-wrapper width-8">
              <select value={currentRole} className="gf-form-input" onChange={this.onOrgRoleChange}>
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
        ) : (
          <td className="width-25">{org.role}</td>
        )}
        {!isRemovingFromOrg && (
          <td colSpan={isChangingRole ? 2 : 1}>
            <div className="pull-right">
              <ConfirmButton
                confirmText="Save"
                onClick={this.onChangeRoleClick}
                onCancel={this.onCancelClick}
                onConfirm={this.onOrgRoleSave}
              >
                Change role
              </ConfirmButton>
            </div>
          </td>
        )}
        {!isChangingRole && (
          <td colSpan={isRemovingFromOrg ? 2 : 1}>
            <div className="pull-right">
              <ConfirmButton
                confirmText="Confirm removal"
                confirmVariant="danger"
                onClick={this.onOrgRemoveClick}
                onCancel={this.onCancelClick}
                onConfirm={this.onOrgRemove}
              >
                Remove from organisation
              </ConfirmButton>
            </div>
          </td>
        )}
      </tr>
    );
  }
}

const OrgRow = withTheme(UnThemedOrgRow);

const getAddToOrgModalStyles = stylesFactory(() => ({
  modal: css`
    width: 500px;
  `,
  buttonRow: css`
    text-align: center;
  `,
}));

interface AddToOrgModalProps {
  isOpen: boolean;
  onOrgAdd(orgId: number, role: string): void;
  onDismiss?(): void;
}

interface AddToOrgModalState {
  selectedOrg: Organization;
  role: string;
}

export class AddToOrgModal extends PureComponent<AddToOrgModalProps, AddToOrgModalState> {
  state: AddToOrgModalState = {
    selectedOrg: null,
    role: 'Admin',
  };

  onOrgSelect = (org: OrgSelectItem) => {
    this.setState({ selectedOrg: { ...org } });
  };

  onOrgRoleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({
      role: event.target.value,
    });
  };

  onAddUserToOrg = () => {
    const { selectedOrg, role } = this.state;
    this.props.onOrgAdd(selectedOrg.id, role);
  };

  onCancel = () => {
    this.props.onDismiss();
  };

  render() {
    const { isOpen } = this.props;
    const { role } = this.state;
    const styles = getAddToOrgModalStyles();
    const buttonRowClass = cx('gf-form-button-row', styles.buttonRow);

    return (
      <Modal className={styles.modal} title="Add to an organization" isOpen={isOpen} onDismiss={this.onCancel}>
        <div className="gf-form-group">
          <h6 className="">Organisation</h6>
          <OrgPicker className="width-25" onSelected={this.onOrgSelect} />
        </div>
        <div className="gf-form-group">
          <h6 className="">Role</h6>
          <div className="gf-form-select-wrapper width-16">
            <select value={role} className="gf-form-input" onChange={this.onOrgRoleChange}>
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
        <div className={buttonRowClass}>
          <Forms.Button variant="primary" onClick={this.onAddUserToOrg}>
            Add to organization
          </Forms.Button>
          <Forms.Button variant="secondary" onClick={this.onCancel}>
            Cancel
          </Forms.Button>
        </div>
      </Modal>
    );
  }
}
