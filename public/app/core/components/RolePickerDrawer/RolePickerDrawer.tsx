import { css, keyframes } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { IconButton, ScrollContainer, Stack, Tab, TabsBar, Text, TextLink, useStyles2 } from '@grafana/ui';
import { useListUserRolesQuery, useListRolesQuery, useSetUserRolesMutation } from 'app/api/clients/roles';
import { useInheritedRoles } from 'app/core/components/RolePicker/hooks';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role } from 'app/types/accessControl';

import { AssignRoles } from './AssignRoles';
import { PermissionsBreakdown } from './PermissionsBreakdown';

const drawerSubtitle = (
  <Trans i18nKey="role-picker.title.description">
    Assign roles to users to ensure granular control over access to Grafana&lsquo;s features and resources. Find out
    more in our{' '}
    <TextLink
      external
      href="https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/#organization-roles"
    >
      documentation
    </TextLink>
    .
  </Trans>
);

export interface Props {
  onClose: () => void;
  userName: string;
  userId: number;
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
  orgId,
  basicRole,
  onBasicRoleChange,
  basicRoleDisabled,
  basicRoleDisabledMessage,
}: Props) => {
  const styles = useStyles2(getDrawerStyles);
  const [activeTab, setActiveTab] = useState<'assign' | 'permissions'>('assign');

  const hasPermission = contextSrv.hasPermission(AccessControlAction.ActionUserRolesList) && userId > 0;
  const { data: userRoles = [] } = useListUserRolesQuery(
    hasPermission ? { userId, includeHidden: true, includeMapped: true, targetOrgId: orgId } : { userId: 0 }
  );
  const { data: roleOptions = [] } = useListRolesQuery(
    { delegatable: true, targetOrgId: orgId }
  );
  const [updateUserRoles] = useSetUserRolesMutation();

  const { inheritedRoles, orphanPermissions, isLoading: inheritanceLoading } = useInheritedRoles(basicRole, userRoles, roleOptions);

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
      <div className={styles.backdrop} />
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
            <div className={styles.subtitle}>{drawerSubtitle}</div>
          </Stack>
          <div className={styles.tabs}>
            <TabsBar>
              <Tab
                label={t('role-picker-drawer.tab-assign', 'Assign Roles')}
                active={activeTab === 'assign'}
                onChangeTab={() => setActiveTab('assign')}
              />
              <Tab
                label={t('role-picker-drawer.tab-permissions', 'Permissions')}
                active={activeTab === 'permissions'}
                onChangeTab={() => setActiveTab('permissions')}
                counter={inheritanceLoading ? undefined : inheritedRoles.size}
              />
            </TabsBar>
          </div>
        </div>
        <ScrollContainer showScrollIndicators>
          <div className={styles.body}>
            {activeTab === 'assign' && (
              <AssignRoles
                basicRole={basicRole}
                appliedRoles={userRoles}
                roleOptions={roleOptions}
                basicRoleDisabled={basicRoleDisabled}
                disabledMessage={basicRoleDisabledMessage}
                canUpdateRoles={canUpdateRoles}
                onUpdate={onUpdate}
              />
            )}
            {activeTab === 'permissions' && (
              <PermissionsBreakdown
                basicRole={basicRole}
                userRoles={userRoles}
                inheritedRoles={inheritedRoles}
                orphanPermissions={orphanPermissions}
                isLoading={inheritanceLoading}
              />
            )}
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
    padding: theme.spacing(2, 2, 0),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    position: 'relative',
  }),
  closeButton: css({
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
  }),
  subtitle: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(1),
  }),
  tabs: css({
    marginLeft: theme.spacing(-2),
    marginRight: theme.spacing(-2),
  }),
  body: css({
    padding: theme.spacing(2),
    height: '100%',
    flexGrow: 1,
    minHeight: 0,
  }),
});
