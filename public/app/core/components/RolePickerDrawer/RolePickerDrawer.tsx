import { css, keyframes } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { IconButton, ScrollContainer, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { useListUserRolesQuery, useListRolesQuery, useSetUserRolesMutation } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role } from 'app/types/accessControl';

import { AssignRoles, TeamRole } from './AssignRoles';

export interface Props {
  onClose: () => void;
  userName: string;
  userId: number;
  userUid?: string;
  orgId?: number;
  basicRole: OrgRole;
  onBasicRoleChange: (newRole: OrgRole) => void;
  basicRoleDisabled?: boolean;
  basicRoleDisabledMessage?: string;
}

export const RolePickerDrawer = ({
  onClose,
  userName,
  userId,
  userUid,
  orgId,
  basicRole,
  onBasicRoleChange,
  basicRoleDisabled,
  basicRoleDisabledMessage,
}: Props) => {
  const styles = useStyles2(getDrawerStyles);

  const hasPermission = contextSrv.hasPermission(AccessControlAction.ActionUserRolesList) && userId > 0;
  const { data: userRoles = [] } = useListUserRolesQuery(
    hasPermission ? { userId, includeHidden: true, includeMapped: true, targetOrgId: orgId } : { userId: 0 }
  );
  const { data: roleOptions = [] } = useListRolesQuery(
    { delegatable: true, targetOrgId: orgId }
  );
  const [updateUserRoles] = useSetUserRolesMutation();

  // Fetch user's teams and their roles
  const [teamRoles, setTeamRoles] = useState<TeamRole[]>([]);
  useEffect(() => {
    if (userId <= 0) {
      return;
    }
    let cancelled = false;
    const fetchTeamRoles = async () => {
      try {
        const teams = await getBackendSrv().get<Array<{ id: number; uid: string; name: string }>>(`/api/users/${userId}/teams`);
        const allTeamRoles: TeamRole[] = [];
        for (const team of teams) {
          try {
            const roles = await getBackendSrv().get<Role[]>(`/api/access-control/teams/${team.id}/roles`);
            for (const role of roles) {
              allTeamRoles.push({ role, teamName: team.name, teamUid: team.uid });
            }
          } catch {
            // Skip teams we can't fetch roles for
          }
        }
        if (!cancelled) {
          setTeamRoles(allTeamRoles);
        }
      } catch {
        // User may not have permission to list teams
      }
    };
    fetchTeamRoles();
    return () => { cancelled = true; };
  }, [userId]);

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

  const onUpdate = useCallback(async (newRoles: Role[], newBuiltInRole?: OrgRole) => {
    if (newBuiltInRole && newBuiltInRole !== basicRole) {
      onBasicRoleChange(newBuiltInRole);
    }

    if (canUpdateRoles) {
      try {
        const filteredRoles = newRoles.filter((role) => !role.mapped);
        const roleUids = filteredRoles.map((role) => role.uid);
        await updateUserRoles({
          userId,
          targetOrgId: orgId,
          setUserRolesCommand: { roleUids },
        }).unwrap();
      } catch (error) {
        console.error('Error updating user roles', error);
      }
    }

    onClose();
  }, [basicRole, canUpdateRoles, onBasicRoleChange, onClose, orgId, updateUserRoles, userId]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.classList.add('body-drawer-open');
    return () => {
      document.body.classList.remove('body-drawer-open');
    };
  }, []);

  const container = document.querySelector('.main-view') || document.body;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.panel} role="dialog" aria-label={userName}>
        <div className={styles.header}>
          <div className={styles.closeButton}>
            <IconButton
              name="times"
              variant="secondary"
              onClick={onClose}
              tooltip={t('grafana-ui.drawer.close', 'Close')}
            />
          </div>
          <Stack direction="column">
            <Text element="h3" truncate>
              {userName}
            </Text>
            <Text color="secondary" variant="bodySmall">
              {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
              Manage role assignments and permissions.{' '}
              <TextLink
                external
                href="https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/#organization-roles"
                variant="bodySmall"
              >
                {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                Learn more
              </TextLink>
            </Text>
          </Stack>
        </div>
        <ScrollContainer showScrollIndicators>
          <div className={styles.body}>
            <AssignRoles
              basicRole={basicRole}
              appliedRoles={userRoles}
              roleOptions={roleOptions}
              teamRoles={teamRoles}
              basicRoleDisabled={basicRoleDisabled}
              disabledMessage={basicRoleDisabledMessage}
              canUpdateRoles={canUpdateRoles}
              onUpdate={onUpdate}
              userUid={userUid}
            />
          </div>
        </ScrollContainer>
      </div>
    </>,
    container
  );
};

const slideIn = keyframes({
  from: { transform: 'translateX(100%)' },
  to: { transform: 'translateX(0)' },
});

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const getDrawerStyles = (theme: GrafanaTheme2) => ({
  backdrop: css({
    position: 'fixed',
    inset: 0,
    zIndex: theme.zIndex.modalBackdrop,
    '&::before': {
      content: '""',
      position: 'fixed',
      inset: 0,
      backgroundColor: theme.components.overlay.background,
      animation: `${fadeIn} 0.2s ease-out`,
    },
  }),
  panel: css({
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '50vw',
    minWidth: 568,
    backgroundColor: theme.colors.background.primary,
    boxShadow: theme.shadows.z3,
    zIndex: theme.zIndex.modalBackdrop + 1,
    display: 'flex',
    flexDirection: 'column',
    animation: `${slideIn} 0.2s ease-out`,
    [theme.breakpoints.down('md')]: {
      width: `calc(100% - ${theme.spacing(2)})`,
      minWidth: 0,
    },
  }),
  header: css({
    flexShrink: 0,
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    position: 'relative',
  }),
  closeButton: css({
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
  }),
  body: css({
    padding: theme.spacing(2),
    height: '100%',
    flexGrow: 1,
    minHeight: 0,
  }),
});
