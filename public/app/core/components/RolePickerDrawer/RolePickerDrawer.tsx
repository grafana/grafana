import { css, keyframes } from '@emotion/css';
import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, ScrollContainer, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { Role } from 'app/types/accessControl';

import { AssignRoles, TeamRole } from './AssignRoles';

export interface Props {
  onClose: () => void;
  entityName: string;

  // Role data — provided by parent
  appliedRoles: Role[];
  roleOptions: Role[];
  teamRoles?: TeamRole[];

  // Basic role — optional (teams don't have one)
  basicRole?: OrgRole;
  onBasicRoleChange?: (newRole: OrgRole) => void;
  basicRoleDisabled?: boolean;
  basicRoleDisabledMessage?: string;

  // Save handler — parent provides the right mutation
  onSave: (newRoles: Role[], newBasicRole?: OrgRole) => Promise<void>;
  canUpdateRoles: boolean;

  // Link to advanced view (optional)
  advancedViewUrl?: string;
}

export const RolePickerDrawer = ({
  onClose,
  entityName,
  appliedRoles,
  roleOptions,
  teamRoles,
  basicRole,
  onBasicRoleChange,
  basicRoleDisabled,
  basicRoleDisabledMessage,
  onSave,
  canUpdateRoles,
  advancedViewUrl,
}: Props) => {
  const styles = useStyles2(getDrawerStyles);

  const onUpdate = useCallback(async (newRoles: Role[], newBuiltInRole?: OrgRole) => {
    if (newBuiltInRole && newBuiltInRole !== basicRole && onBasicRoleChange) {
      onBasicRoleChange(newBuiltInRole);
    }

    try {
      const filteredRoles = newRoles.filter((role) => !role.mapped);
      await onSave(filteredRoles, newBuiltInRole);
    } catch (error) {
      console.error('Error updating roles', error);
    }

    onClose();
  }, [basicRole, onBasicRoleChange, onClose, onSave]);

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
      <div className={styles.panel} role="dialog" aria-label={entityName}>
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
              {entityName}
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
              appliedRoles={appliedRoles}
              roleOptions={roleOptions}
              teamRoles={teamRoles}
              basicRoleDisabled={basicRoleDisabled}
              disabledMessage={basicRoleDisabledMessage}
              canUpdateRoles={canUpdateRoles}
              onUpdate={onUpdate}
              advancedViewUrl={advancedViewUrl}
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
