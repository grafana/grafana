import { useState, useCallback, useMemo } from 'react';

import { OrgRole } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Stack, Alert, Button, Modal, Field } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { Role, AccessControlAction } from 'app/types/accessControl';
import { TeamWithRoles } from 'app/types/teams';
import { UserDTO, UserOrg } from 'app/types/user';

import { AddRoleModal } from './AddRoleModal';
import { OrgRolePicker } from './OrgRolePicker';
import type { RoleWithOrg } from './UserPermissionsPage';
import { UserPermissionsTable } from './UserPermissionsTable';

interface Props {
  user: UserDTO;
  roles: RoleWithOrg[];
  teams: TeamWithRoles[];
  orgs: UserOrg[];
  onRolesChanged: () => void;
}

export const UserRolesPage = ({ user, roles, teams, orgs, onRolesChanged }: Props) => {
  const isEnterprise = contextSrv.licensedAccessControlEnabled();
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<OrgRole>(OrgRole.Viewer);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Get current organization from global context
  const currentOrgId = contextSrv.user.orgId;
  const currentOrgName = contextSrv.user.orgName;

  const canAddRoles = contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd);
  const canChangeOrgRole = contextSrv.hasPermission(AccessControlAction.OrgUsersWrite);

  // Filter roles to only show current org
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => role.orgId === currentOrgId);
  }, [roles, currentOrgId]);

  // Filter teams to only show current org
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => team.orgId === currentOrgId);
  }, [teams, currentOrgId]);

  // Get current role UIDs for current org (directly assigned only)
  const currentRoleUids = useMemo(() => {
    return filteredRoles.filter((role) => !role.mapped).map((role) => role.uid);
  }, [filteredRoles]);

  // Get all role UIDs (from any source: direct, team, org, external)
  const allAssignedRoleUids = useMemo(() => {
    const roleUids = new Set<string>();

    // Add directly assigned roles
    filteredRoles.forEach((role) => roleUids.add(role.uid));

    // Add roles from teams
    filteredTeams.forEach((team) => {
      team.roles?.forEach((role) => roleUids.add(role.uid));
    });

    return Array.from(roleUids);
  }, [filteredRoles, filteredTeams]);

  // Get current org object
  const currentOrg = useMemo(() => {
    return orgs.find((org) => org.orgId === currentOrgId);
  }, [orgs, currentOrgId]);

  const handleOpenChangeRoleModal = useCallback(() => {
    if (currentOrg) {
      setSelectedRole(currentOrg.role);
      setIsChangeRoleModalOpen(true);
    }
  }, [currentOrg]);

  const handleChangeRole = useCallback(async () => {
    if (!user || !currentOrg) {
      return;
    }

    try {
      setIsUpdatingRole(true);
      await getBackendSrv().patch(`/api/orgs/${currentOrgId}/users/${user.uid}`, {
        role: selectedRole,
      });
      setIsChangeRoleModalOpen(false);
      // Reload data to reflect changes
      onRolesChanged();
    } catch (err) {
      console.error('Error updating organization role:', err);
    } finally {
      setIsUpdatingRole(false);
    }
  }, [user, currentOrg, currentOrgId, selectedRole, onRolesChanged]);

  // Show enterprise feature notice in OSS mode
  if (!isEnterprise) {
    return (
      <Alert
        severity="info"
        title={t('admin.user-roles.enterprise-feature-title', 'Enterprise Feature')}
      >
        <Trans i18nKey="admin.user-roles.enterprise-feature-message">
          Role management requires Grafana Enterprise with RBAC enabled. Contact your administrator or visit
          grafana.com to learn more about Grafana Enterprise.
        </Trans>
      </Alert>
    );
  }

  return (
    <Stack gap={1} direction="column">
      {!currentOrg && (
        <Alert
          severity="warning"
          title={t(
            'admin.user-roles.not-member-title',
            'User not part of the {{orgName}} organization',
            { orgName: currentOrgName }
          )}
        >
          <Trans i18nKey="admin.user-roles.not-member-message">
            This user is not a member of the currently selected organization. Switch to an organization the user
            belongs to in order to manage their roles.
          </Trans>
        </Alert>
      )}

      {currentOrg && (
        <>
          <UserPermissionsTable
            roles={filteredRoles}
            teams={filteredTeams}
            orgs={[currentOrg]}
            userId={user.id}
            userName={user.login}
            onRolesChanged={onRolesChanged}
            onChangeBasicRole={canChangeOrgRole ? handleOpenChangeRoleModal : undefined}
          />

          {canAddRoles && (
            <Stack gap={2}>
              <Button variant="primary" icon="plus" onClick={() => setIsAddRoleModalOpen(true)}>
                <Trans i18nKey="admin.user-roles.add-role-button">Add Role</Trans>
              </Button>
            </Stack>
          )}

          {canAddRoles && (
            <AddRoleModal
              isOpen={isAddRoleModalOpen}
              userId={user.id}
              userUid={user.uid}
              currentRoleUids={currentRoleUids}
              allAssignedRoleUids={allAssignedRoleUids}
              selectedOrgId={currentOrgId}
              onDismiss={() => setIsAddRoleModalOpen(false)}
              onRoleAdded={() => {
                setIsAddRoleModalOpen(false);
                onRolesChanged();
              }}
            />
          )}

          {canChangeOrgRole && (
            <Modal
              title={t('admin.user-roles.change-role-title', 'Change Basic Organization Role')}
              isOpen={isChangeRoleModalOpen}
              onDismiss={() => setIsChangeRoleModalOpen(false)}
            >
              <Field label={t('admin.user-roles.role-label', 'Role')} noMargin>
                <OrgRolePicker
                  inputId="change-org-role"
                  value={selectedRole}
                  onChange={setSelectedRole}
                  autoFocus
                />
              </Field>
              <Modal.ButtonRow>
                <Button variant="secondary" onClick={() => setIsChangeRoleModalOpen(false)}>
                  <Trans i18nKey="admin.user-roles.cancel-button">Cancel</Trans>
                </Button>
                <Button variant="primary" onClick={handleChangeRole} disabled={isUpdatingRole}>
                  {isUpdatingRole ? (
                    <Trans i18nKey="admin.user-roles.saving">Saving...</Trans>
                  ) : (
                    <Trans i18nKey="admin.user-roles.save-button">Save</Trans>
                  )}
                </Button>
              </Modal.ButtonRow>
            </Modal>
          )}
        </>
      )}
    </Stack>
  );
};
