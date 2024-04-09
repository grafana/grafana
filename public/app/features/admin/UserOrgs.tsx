import { css, cx } from '@emotion/css';
import React, { PureComponent, ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  ConfirmButton,
  Field,
  HorizontalGroup,
  Icon,
  Modal,
  stylesFactory,
  Themeable2,
  Tooltip,
  useStyles2,
  withTheme2,
  Stack,
} from '@grafana/ui';
import { RolePicker } from 'app/core/components/RolePicker/RolePicker';
import { fetchRoleOptions, updateUserRoles, fetchUserRoles } from 'app/core/components/RolePicker/api';
import { OrgPicker, OrgSelectItem } from 'app/core/components/Select/OrgPicker';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Organization, OrgRole, Role, UserDTO, UserOrg } from 'app/types';

import { OrgRolePicker } from './OrgRolePicker';

interface Props {
  orgs: UserOrg[];
  user: UserDTO;
  isExternalUser?: boolean;

  onOrgRemove: (orgId: number) => void;
  onOrgRoleChange: (orgId: number, newRole: OrgRole) => void;
  onOrgAdd: (orgId: number, role: OrgRole, roles?: Role[]) => void;
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

    const canAddToOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersAdd) && !isExternalUser;
    return (
      <div>
        <h3 className="page-heading">Organizations</h3>
        <Stack gap={1.5} direction="column">
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

          <div>
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
        </Stack>
      </div>
    );
  }
}

const getOrgRowStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    removeButton: css`
      margin-right: 0.6rem;
      text-decoration: underline;
      color: ${theme.v1.palette.blue95};
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
      color: ${theme.v1.palette.blue95};
    `,
    rolePickerWrapper: css`
      display: flex;
    `,
    rolePicker: css`
      flex: auto;
      margin-right: ${theme.spacing(1)};
    `,
  };
});

interface OrgRowProps extends Themeable2 {
  user: UserDTO;
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
    roles: [],
  };

  componentDidMount() {
    if (contextSrv.licensedAccessControlEnabled()) {
      if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
        Promise.all([fetchUserRoles(this.props.user.id, this.props.org.orgId), fetchRoleOptions(this.props.org.orgId)])
          .then(([roles, roleOptions]) => {
            this.setState({
              roles,
              roleOptions,
            });
          })
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
    const authSource = user?.authLabels?.length && user?.authLabels[0];
    const lockMessage = authSource ? `Synced via ${authSource}` : '';
    const { currentRole, isChangingRole } = this.state;
    const styles = getOrgRowStyles(theme);
    const labelClass = cx('width-16', styles.label);
    const canChangeRole = contextSrv.hasPermission(AccessControlAction.OrgUsersWrite);
    const canRemoveFromOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersRemove) && !isExternalUser;
    const rolePickerDisabled = isExternalUser || !canChangeRole;
    const canUpdateRoles =
      contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
      contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);
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
                <RolePicker
                  onSubmit={async (newRoles: Role[], basicRole?: OrgRole) => {
                    await updateUserRoles(newRoles, user.id, org.orgId);
                    if (basicRole !== undefined) {
                      this.onBasicRoleChange(basicRole);
                    }
                    this.setState({ roles: newRoles });
                  }}
                  roles={this.state.roles}
                  basicRole={org.role}
                  roleOptions={this.state.roleOptions}
                  showBasicRole
                  canUpdateRoles={canUpdateRoles}
                  basicRoleDisabled={rolePickerDisabled}
                  basicRoleDisabledMessage="This user's role is not editable because it is synchronized from your auth provider.
                    Refer to the Grafana authentication docs for details."
                />
              </div>
              {isExternalUser && <ExternalUserTooltip lockMessage={lockMessage} />}
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
                    lockMessage={lockMessage}
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

const OrgRow = withTheme2(UnThemedOrgRow);

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
  user: UserDTO;
  userOrgs: UserOrg[];
  onOrgAdd(orgId: number, basicRole: string, roles?: Role[]): void;
  onDismiss?(): void;
}

interface AddToOrgModalState {
  selectedOrg: Organization | null;
  role: OrgRole;
  roleOptions: Role[];
  roles: Role[];
}

export class AddToOrgModal extends PureComponent<AddToOrgModalProps, AddToOrgModalState> {
  state: AddToOrgModalState = {
    selectedOrg: null,
    role: OrgRole.Viewer,
    roleOptions: [],
    roles: [],
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

  onSubmit = async () => {
    const { selectedOrg, role, roles: pendingRoles } = this.state;
    if (selectedOrg === null) {
      throw new Error('invalid form state: selectedOrg must be present');
    }
    const roles =
      contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd)
        ? pendingRoles
        : undefined;
    this.props.onOrgAdd(selectedOrg.id, role, roles);
    this.setState({
      roles: [],
      selectedOrg: null,
    });
  };

  onCancel = () => {
    // clear selectedOrg when modal is canceled
    this.setState({
      selectedOrg: null,
      roles: [],
    });
    if (this.props.onDismiss) {
      this.props.onDismiss();
    }
  };

  render() {
    const { isOpen, userOrgs } = this.props;
    const { role, roleOptions, selectedOrg } = this.state;
    const styles = getAddToOrgModalStyles();
    const canUpdateRoles =
      contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
      contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

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
          <RolePicker
            onSubmit={(newRoles: Role[], basicRole?: OrgRole) => {
              this.setState((current) => ({
                roles: newRoles,
                role: basicRole || current.role,
              }));
            }}
            roles={this.state.roles}
            showBasicRole
            basicRole={role}
            basicRoleDisabled={false}
            roleOptions={roleOptions}
            canUpdateRoles={canUpdateRoles}
            submitButtonText="Apply"
          />
        </Field>
        <Modal.ButtonRow>
          <HorizontalGroup spacing="md" justify="center">
            <Button variant="secondary" fill="outline" onClick={this.onCancel}>
              Cancel
            </Button>
            <Button variant="primary" disabled={selectedOrg === null} onClick={this.onSubmit}>
              Add to organization
            </Button>
          </HorizontalGroup>
        </Modal.ButtonRow>
      </Modal>
    );
  }
}

interface ChangeOrgButtonProps {
  lockMessage?: string;
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
  lockMessageClass: css`
    font-style: italic;
    margin-left: 1.8rem;
    margin-right: 0.6rem;
  `,
  icon: css`
    line-height: 2;
  `,
});

export function ChangeOrgButton({
  lockMessage,
  onChangeRoleClick,
  isExternalUser,
  onOrgRoleSave,
  onCancelClick,
}: ChangeOrgButtonProps): ReactElement {
  const styles = useStyles2(getChangeOrgButtonTheme);
  return (
    <div className={styles.disabledTooltip}>
      {isExternalUser ? (
        <>
          <span className={styles.lockMessageClass}>{lockMessage}</span>
          <Tooltip
            placement="right-end"
            interactive={true}
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
            <div className={styles.icon}>
              <Icon name="question-circle" />
            </div>
          </Tooltip>
        </>
      ) : (
        <ConfirmButton
          confirmText="Save"
          onClick={onChangeRoleClick}
          onCancel={onCancelClick}
          onConfirm={onOrgRoleSave}
          disabled={isExternalUser}
        >
          Change role
        </ConfirmButton>
      )}
    </div>
  );
}
interface ExternalUserTooltipProps {
  lockMessage?: string;
}

export const ExternalUserTooltip = ({ lockMessage }: ExternalUserTooltipProps) => {
  const styles = useStyles2(getTooltipStyles);

  return (
    <div className={styles.disabledTooltip}>
      <span className={styles.lockMessageClass}>{lockMessage}</span>
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

const getTooltipStyles = (theme: GrafanaTheme2) => ({
  disabledTooltip: css`
    display: flex;
  `,
  tooltipItemLink: css`
    color: ${theme.v1.palette.blue95};
  `,
  lockMessageClass: css`
    font-style: italic;
    margin-left: 1.8rem;
    margin-right: 0.6rem;
  `,
});
