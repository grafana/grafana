import { css, cx } from '@emotion/css';
import React, { PureComponent, ReactElement } from 'react';

import { GrafanaTheme, GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  ConfirmButton,
  Field,
  HorizontalGroup,
  Icon,
  Modal,
  stylesFactory,
  Themeable,
  Tooltip,
  useStyles2,
  useTheme,
  withTheme,
} from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchRoleOptions, updateUserRoles } from 'app/core/components/RolePicker/api';
import { OrgPicker, OrgSelectItem } from 'app/core/components/Select/OrgPicker';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Organization, OrgRole, Role, UserDTO, UserOrg } from 'app/types';

import { OrgRolePicker } from './OrgRolePicker';

interface Props {
  orgs: UserOrg[];
  user?: UserDTO;
  isExternalUser?: boolean;

  onOrgRemove: (orgId: number) => void;
  onOrgRoleChange: (orgId: number, newRole: OrgRole) => void;
  onOrgAdd: (orgId: number, role: OrgRole) => void;
}

interface State {
  showAddOrgModal: boolean;
}

export class UserOrgs extends PureComponent<Props, State> {
  addToOrgButtonRef = React.createRef<HTMLButtonElement>();
  state = {
    showAddOrgModal: false,
  };

  showOrgAddModal = () => {
    this.setState({ showAddOrgModal: true });
  };

  dismissOrgAddModal = () => {
    this.setState({ showAddOrgModal: false }, () => {
      this.addToOrgButtonRef.current?.focus();
    });
  };

  render() {
    const { user, orgs, isExternalUser, onOrgRoleChange, onOrgRemove, onOrgAdd } = this.props;
    const { showAddOrgModal } = this.state;
    const addToOrgContainerClass = css`
      margin-top: 0.8rem;
    `;

    const canAddToOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersAdd) && !isExternalUser;
    return (
      <>
        <h3 className="page-heading">Organizations</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                {orgs.map((org, index) => (
                  <OrgRow
                    key={`${org.orgId}-${index}`}
                    isExternalUser={isExternalUser}
                    user={user}
                    org={org}
                    onOrgRoleChange={onOrgRoleChange}
                    onOrgRemove={onOrgRemove}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className={addToOrgContainerClass}>
            {canAddToOrg && (
              <Button variant="secondary" onClick={this.showOrgAddModal} ref={this.addToOrgButtonRef}>
                Add user to organization
              </Button>
            )}
          </div>
          <AddToOrgModal
            user={user}
            userOrgs={orgs}
            isOpen={showAddOrgModal}
            onOrgAdd={onOrgAdd}
            onDismiss={this.dismissOrgAddModal}
          />
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
    disabledTooltip: css`
      display: flex;
    `,
    tooltipItem: css`
      margin-left: 5px;
    `,
    tooltipItemLink: css`
      color: ${theme.palette.blue95};
    `,
    rolePickerWrapper: css`
      display: flex;
    `,
    rolePicker: css`
      flex: auto;
      margin-right: ${theme.spacing.sm};
    `,
  };
});

interface OrgRowProps extends Themeable {
  user?: UserDTO;
  org: UserOrg;
  isExternalUser?: boolean;
  onOrgRemove: (orgId: number) => void;
  onOrgRoleChange: (orgId: number, newRole: OrgRole) => void;
}

class UnThemedOrgRow extends PureComponent<OrgRowProps> {
  state = {
    currentRole: this.props.org.role,
    isChangingRole: false,
    roleOptions: [],
  };

  componentDidMount() {
    if (contextSrv.licensedAccessControlEnabled()) {
      if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
        fetchRoleOptions(this.props.org.orgId)
          .then((roles) => this.setState({ roleOptions: roles }))
          .catch((e) => console.error(e));
      }
    }
  }

  onOrgRemove = async () => {
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

  onBasicRoleChange = (newRole: OrgRole) => {
    this.props.onOrgRoleChange(this.props.org.orgId, newRole);
  };

  render() {
    const { user, org, isExternalUser, theme } = this.props;
    const { currentRole, isChangingRole } = this.state;
    const styles = getOrgRowStyles(theme);
    const labelClass = cx('width-16', styles.label);
    const canChangeRole = contextSrv.hasPermission(AccessControlAction.OrgUsersWrite);
    const canRemoveFromOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersRemove);
    const rolePickerDisabled = isExternalUser || !canChangeRole;

    const inputId = `${org.name}-input`;
    return (
      <tr>
        <td className={labelClass}>
          <label htmlFor={inputId}>{org.name}</label>
        </td>
        {contextSrv.licensedAccessControlEnabled() ? (
          <td>
            <div className={styles.rolePickerWrapper}>
              <div className={styles.rolePicker}>
                <UserRolePicker
                  userId={user?.id || 0}
                  orgId={org.orgId}
                  basicRole={org.role}
                  roleOptions={this.state.roleOptions}
                  onBasicRoleChange={this.onBasicRoleChange}
                  basicRoleDisabled={rolePickerDisabled}
                />
              </div>
              {isExternalUser && <ExternalUserTooltip />}
            </div>
          </td>
        ) : (
          <>
            {isChangingRole ? (
              <td>
                <OrgRolePicker inputId={inputId} value={currentRole} onChange={this.onOrgRoleChange} autoFocus />
              </td>
            ) : (
              <td className="width-25">{org.role}</td>
            )}
            <td colSpan={1}>
              <div className="pull-right">
                {canChangeRole && (
                  <ChangeOrgButton
                    isExternalUser={isExternalUser}
                    onChangeRoleClick={this.onChangeRoleClick}
                    onCancelClick={this.onCancelClick}
                    onOrgRoleSave={this.onOrgRoleSave}
                  />
                )}
              </div>
            </td>
          </>
        )}
        <td colSpan={1}>
          <div className="pull-right">
            {canRemoveFromOrg && (
              <ConfirmButton
                confirmText="Confirm removal"
                confirmVariant="destructive"
                onCancel={this.onCancelClick}
                onConfirm={this.onOrgRemove}
                autoFocus
              >
                Remove from organization
              </ConfirmButton>
            )}
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
  modalContent: css`
    overflow: visible;
  `,
}));

interface AddToOrgModalProps {
  isOpen: boolean;
  user?: UserDTO;
  userOrgs: UserOrg[];
  onOrgAdd(orgId: number, role: string): void;

  onDismiss?(): void;
}

interface AddToOrgModalState {
  selectedOrg: Organization | null;
  role: OrgRole;
  roleOptions: Role[];
  pendingOrgId: number | null;
  pendingUserId: number | null;
  pendingRoles: Role[];
}

export class AddToOrgModal extends PureComponent<AddToOrgModalProps, AddToOrgModalState> {
  state: AddToOrgModalState = {
    selectedOrg: null,
    role: OrgRole.Viewer,
    roleOptions: [],
    pendingOrgId: null,
    pendingUserId: null,
    pendingRoles: [],
  };

  onOrgSelect = (org: OrgSelectItem) => {
    const userOrg = this.props.userOrgs.find((userOrg) => userOrg.orgId === org.value?.id);
    this.setState({ selectedOrg: org.value!, role: userOrg?.role || OrgRole.Viewer });
    if (contextSrv.licensedAccessControlEnabled()) {
      if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
        fetchRoleOptions(org.value?.id)
          .then((roles) => this.setState({ roleOptions: roles }))
          .catch((e) => console.error(e));
      }
    }
  };

  onOrgRoleChange = (newRole: OrgRole) => {
    this.setState({
      role: newRole,
    });
  };

  onAddUserToOrg = async () => {
    const { selectedOrg, role } = this.state;
    this.props.onOrgAdd(selectedOrg!.id, role);
    // add the stored userRoles also
    if (contextSrv.licensedAccessControlEnabled()) {
      if (contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd)) {
        if (this.state.pendingUserId) {
          await updateUserRoles(this.state.pendingRoles, this.state.pendingUserId!, this.state.pendingOrgId!);
          // clear pending state
          this.state.pendingOrgId = null;
          this.state.pendingRoles = [];
          this.state.pendingUserId = null;
        }
      }
    }
  };

  onCancel = () => {
    // clear selectedOrg when modal is canceled
    this.setState({
      selectedOrg: null,
      pendingRoles: [],
      pendingOrgId: null,
      pendingUserId: null,
    });
    if (this.props.onDismiss) {
      this.props.onDismiss();
    }
  };

  onRoleUpdate = async (roles: Role[], userId: number, orgId: number | undefined) => {
    // keep the new role assignments for user
    this.setState({
      pendingRoles: roles,
      pendingOrgId: orgId!,
      pendingUserId: userId,
    });
  };

  render() {
    const { isOpen, user, userOrgs } = this.props;
    const { role, roleOptions, selectedOrg } = this.state;
    const styles = getAddToOrgModalStyles();
    return (
      <Modal
        className={styles.modal}
        contentClassName={styles.modalContent}
        title="Add to an organization"
        isOpen={isOpen}
        onDismiss={this.onCancel}
      >
        <Field label="Organization">
          <OrgPicker inputId="new-org-input" onSelected={this.onOrgSelect} excludeOrgs={userOrgs} autoFocus />
        </Field>
        <Field label="Role" disabled={selectedOrg === null}>
          {contextSrv.accessControlEnabled() ? (
            <UserRolePicker
              userId={user?.id || 0}
              orgId={selectedOrg?.id}
              basicRole={role}
              onBasicRoleChange={this.onOrgRoleChange}
              basicRoleDisabled={false}
              roleOptions={roleOptions}
              apply={true}
              onApplyRoles={this.onRoleUpdate}
              pendingRoles={this.state.pendingRoles}
            />
          ) : (
            <OrgRolePicker inputId="new-org-role-input" value={role} onChange={this.onOrgRoleChange} />
          )}
        </Field>
        <Modal.ButtonRow>
          <HorizontalGroup spacing="md" justify="center">
            <Button variant="secondary" fill="outline" onClick={this.onCancel}>
              Cancel
            </Button>
            <Button variant="primary" disabled={selectedOrg === null} onClick={this.onAddUserToOrg}>
              Add to organization
            </Button>
          </HorizontalGroup>
        </Modal.ButtonRow>
      </Modal>
    );
  }
}

interface ChangeOrgButtonProps {
  isExternalUser?: boolean;
  onChangeRoleClick: () => void;
  onCancelClick: () => void;
  onOrgRoleSave: () => void;
}

const getChangeOrgButtonTheme = (theme: GrafanaTheme2) => ({
  disabledTooltip: css`
    display: flex;
  `,
  tooltipItemLink: css`
    color: ${theme.v1.palette.blue95};
  `,
});

export function ChangeOrgButton({
  onChangeRoleClick,
  isExternalUser,
  onOrgRoleSave,
  onCancelClick,
}: ChangeOrgButtonProps): ReactElement {
  const styles = useStyles2(getChangeOrgButtonTheme);
  return (
    <div className={styles.disabledTooltip}>
      <ConfirmButton
        confirmText="Save"
        onClick={onChangeRoleClick}
        onCancel={onCancelClick}
        onConfirm={onOrgRoleSave}
        disabled={isExternalUser}
      >
        Change role
      </ConfirmButton>
      {isExternalUser && (
        <Tooltip
          placement="right-end"
          content={
            <div>
              This user&apos;s role is not editable because it is synchronized from your auth provider. Refer to
              the&nbsp;
              <a
                className={styles.tooltipItemLink}
                href={'https://grafana.com/docs/grafana/latest/auth'}
                rel="noreferrer"
                target="_blank"
              >
                Grafana authentication docs
              </a>
              &nbsp;for details.
            </div>
          }
        >
          <Icon name="question-circle" />
        </Tooltip>
      )}
    </div>
  );
}

const ExternalUserTooltip: React.FC = () => {
  const theme = useTheme();
  const styles = getTooltipStyles(theme);

  return (
    <div className={styles.disabledTooltip}>
      <Tooltip
        placement="right-end"
        interactive={true}
        content={
          <div>
            This user&apos;s built-in role is not editable because it is synchronized from your auth provider. Refer to
            the&nbsp;
            <a
              className={styles.tooltipItemLink}
              href={'https://grafana.com/docs/grafana/latest/auth'}
              rel="noreferrer noopener"
              target="_blank"
            >
              Grafana authentication docs
            </a>
            &nbsp;for details.
          </div>
        }
      >
        <Icon name="question-circle" />
      </Tooltip>
    </div>
  );
};

const getTooltipStyles = stylesFactory((theme: GrafanaTheme) => ({
  disabledTooltip: css`
    display: flex;
  `,
  tooltipItemLink: css`
    color: ${theme.palette.blue95};
  `,
}));
