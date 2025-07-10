import { css, cx } from '@emotion/css';
import { createRef, PureComponent, ReactElement } from 'react';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Button,
  ConfirmButton,
  Field,
  Icon,
  Modal,
  stylesFactory,
  Themeable2,
  Tooltip,
  useStyles2,
  withTheme2,
  Stack,
} from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchRoleOptions, updateUserRoles } from 'app/core/components/RolePicker/api';
import { OrgPicker, OrgSelectItem } from 'app/core/components/Select/OrgPicker';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Role } from 'app/types/accessControl';
import { Organization } from 'app/types/organization';
import { UserOrg, UserDTO } from 'app/types/user';

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
  addToOrgButtonRef = createRef<HTMLButtonElement>();
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
        <h3 className="page-heading">
          <Trans i18nKey="admin.user-orgs.title">Organizations</Trans>
        </h3>
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
                <Trans i18nKey="admin.user-orgs.add-button">Add user to organization</Trans>
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
    removeButton: css({
      marginRight: '0.6rem',
      textDecoration: 'underline',
      color: theme.v1.palette.blue95,
    }),
    label: css({
      fontWeight: 500,
    }),
    disabledTooltip: css({
      display: 'flex',
    }),
    tooltipItem: css({
      marginLeft: '5px',
    }),
    tooltipItemLink: css({
      color: theme.v1.palette.blue95,
    }),
    rolePickerWrapper: css({
      display: 'flex',
    }),
    rolePicker: css({
      flex: 'auto',
      marginRight: theme.spacing(1),
    }),
  };
});

interface OrgRowProps extends Themeable2 {
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
    const authSource = user?.authLabels?.length && user?.authLabels[0];
    const lockMessage = authSource ? `Synced via ${authSource}` : '';
    const { currentRole, isChangingRole } = this.state;
    const styles = getOrgRowStyles(theme);
    const labelClass = cx('width-16', styles.label);
    const canChangeRole = contextSrv.hasPermission(AccessControlAction.OrgUsersWrite);
    const canRemoveFromOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersRemove) && !isExternalUser;
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
              {canChangeRole && (
                <ChangeOrgButton
                  lockMessage={lockMessage}
                  isExternalUser={isExternalUser}
                  onChangeRoleClick={this.onChangeRoleClick}
                  onCancelClick={this.onCancelClick}
                  onOrgRoleSave={this.onOrgRoleSave}
                />
              )}
            </td>
          </>
        )}
        <td colSpan={1}>
          {canRemoveFromOrg && (
            <ConfirmButton
              confirmText={t('admin.un-themed-org-row.confirmText-confirm-removal', 'Confirm removal')}
              confirmVariant="destructive"
              onCancel={this.onCancelClick}
              onConfirm={this.onOrgRemove}
            >
              {t('admin.user-orgs.remove-button', 'Remove from organization')}
            </ConfirmButton>
          )}
        </td>
      </tr>
    );
  }
}

const OrgRow = withTheme2(UnThemedOrgRow);

const getAddToOrgModalStyles = stylesFactory(() => ({
  modal: css({
    width: '500px',
  }),
  buttonRow: css({
    textAlign: 'center',
  }),
  modalContent: css({
    overflow: 'visible',
  }),
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
          this.setState({
            pendingOrgId: null,
            pendingRoles: [],
            pendingUserId: null,
          });
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
        title={t('admin.add-to-org-modal.title-add-to-an-organization', 'Add to an organization')}
        isOpen={isOpen}
        onDismiss={this.onCancel}
      >
        <Field label={t('admin.add-to-org-modal.label-organization', 'Organization')}>
          <OrgPicker inputId="new-org-input" onSelected={this.onOrgSelect} excludeOrgs={userOrgs} autoFocus />
        </Field>
        <Field label={t('admin.add-to-org-modal.label-role', 'Role')} disabled={selectedOrg === null}>
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
        </Field>
        <Modal.ButtonRow>
          <Stack gap={2} justifyContent="center">
            <Button variant="secondary" fill="outline" onClick={this.onCancel}>
              <Trans i18nKey="admin.user-orgs-modal.cancel-button">Cancel</Trans>
            </Button>
            <Button variant="primary" disabled={selectedOrg === null} onClick={this.onAddUserToOrg}>
              <Trans i18nKey="admin.user-orgs-modal.add-button">Add to organization</Trans>
            </Button>
          </Stack>
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
  disabledTooltip: css({
    display: 'flex',
  }),
  tooltipItemLink: css({
    color: theme.v1.palette.blue95,
  }),
  lockMessageClass: css({
    fontStyle: 'italic',
    marginLeft: '1.8rem',
    marginRight: '0.6rem',
  }),
  icon: css({
    lineHeight: 2,
  }),
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
                <Trans i18nKey="admin.user-orgs.role-not-editable">
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
                </Trans>
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
          confirmText={t('admin.change-org-button.confirmText-save', 'Save')}
          onClick={onChangeRoleClick}
          onCancel={onCancelClick}
          onConfirm={onOrgRoleSave}
          disabled={isExternalUser}
        >
          {t('admin.user-orgs.change-role-button', 'Change role')}
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
            <Trans i18nKey="admin.user-orgs.external-user-tooltip">
              This user&apos;s built-in role is not editable because it is synchronized from your auth provider. Refer
              to the&nbsp;
              <a
                className={styles.tooltipItemLink}
                href={'https://grafana.com/docs/grafana/latest/auth'}
                rel="noreferrer noopener"
                target="_blank"
              >
                Grafana authentication docs
              </a>
              &nbsp;for details.
            </Trans>
          </div>
        }
      >
        <Icon name="question-circle" />
      </Tooltip>
    </div>
  );
};

const getTooltipStyles = (theme: GrafanaTheme2) => ({
  disabledTooltip: css({
    display: 'flex',
  }),
  tooltipItemLink: css({
    color: theme.v1.palette.blue95,
  }),
  lockMessageClass: css({
    fontStyle: 'italic',
    marginLeft: '1.8rem',
    marginRight: '0.6rem',
  }),
});
