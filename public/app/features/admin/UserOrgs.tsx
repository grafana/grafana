import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import {
  Modal,
  Themeable,
  stylesFactory,
  withTheme,
  ConfirmButton,
  Button,
  HorizontalGroup,
  Container,
  Field,
} from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { UserOrg, Organization, OrgRole } from 'app/types';
import { OrgPicker, OrgSelectItem } from 'app/core/components/Select/OrgPicker';
import { OrgRolePicker } from './OrgRolePicker';

interface Props {
  orgs: UserOrg[];

  onOrgRemove: (orgId: number) => void;
  onOrgRoleChange: (orgId: number, newRole: OrgRole) => void;
  onOrgAdd: (orgId: number, role: OrgRole) => void;
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
            <Button variant="secondary" onClick={this.showOrgAddModal(true)}>
              Add user to organisation
            </Button>
          </div>
          <AddToOrgModal isOpen={showAddOrgModal} onOrgAdd={onOrgAdd} onDismiss={this.showOrgAddModal(false)} />
        </div>
      </>
    );
  }
}

const getOrgRowStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    removeButton: css`
      margin-right: 0.6rem;
      text-decoration: underline;
      color: ${theme.palette.blue95};
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
  currentRole: OrgRole;
  isChangingRole: boolean;
}

class UnThemedOrgRow extends PureComponent<OrgRowProps, OrgRowState> {
  state = {
    currentRole: this.props.org.role,
    isChangingRole: false,
  };

  onOrgRemove = () => {
    const { org } = this.props;
    this.props.onOrgRemove(org.orgId);
  };

  onChangeRoleClick = () => {
    const { org } = this.props;
    this.setState({ isChangingRole: true, currentRole: org.role });
  };

  onOrgRoleChange = (newRole: OrgRole) => {
    this.setState({ currentRole: newRole });
  };

  onOrgRoleSave = () => {
    this.props.onOrgRoleChange(this.props.org.orgId, this.state.currentRole);
  };

  onCancelClick = () => {
    this.setState({ isChangingRole: false });
  };

  render() {
    const { org, theme } = this.props;
    const { currentRole, isChangingRole } = this.state;
    const styles = getOrgRowStyles(theme);
    const labelClass = cx('width-16', styles.label);

    return (
      <tr>
        <td className={labelClass}>{org.name}</td>
        {isChangingRole ? (
          <td>
            <OrgRolePicker value={currentRole} onChange={this.onOrgRoleChange} />
          </td>
        ) : (
          <td className="width-25">{org.role}</td>
        )}
        <td colSpan={1}>
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
        <td colSpan={1}>
          <div className="pull-right">
            <ConfirmButton
              confirmText="Confirm removal"
              confirmVariant="destructive"
              onCancel={this.onCancelClick}
              onConfirm={this.onOrgRemove}
            >
              Remove from organisation
            </ConfirmButton>
          </div>
        </td>
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
  role: OrgRole;
}

export class AddToOrgModal extends PureComponent<AddToOrgModalProps, AddToOrgModalState> {
  state: AddToOrgModalState = {
    selectedOrg: null,
    role: OrgRole.Admin,
  };

  onOrgSelect = (org: OrgSelectItem) => {
    this.setState({ selectedOrg: { ...org } });
  };

  onOrgRoleChange = (newRole: OrgRole) => {
    this.setState({
      role: newRole,
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

    return (
      <Modal className={styles.modal} title="Add to an organization" isOpen={isOpen} onDismiss={this.onCancel}>
        <Field label="Organisation">
          <OrgPicker onSelected={this.onOrgSelect} />
        </Field>
        <Field label="Role">
          <OrgRolePicker value={role} onChange={this.onOrgRoleChange} />
        </Field>
        <Container padding="md">
          <HorizontalGroup spacing="md" justify="center">
            <Button variant="primary" onClick={this.onAddUserToOrg}>
              Add to organisation
            </Button>
            <Button variant="secondary" onClick={this.onCancel}>
              Cancel
            </Button>
          </HorizontalGroup>
        </Container>
      </Modal>
    );
  }
}
