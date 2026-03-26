import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Button, Icon, LoadingPlaceholder, Select, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import {
  Display,
  TeamBinding,
  useCreateTeamBindingMutation,
  useDeleteTeamBindingMutation,
  useGetDisplayMappingQuery,
  useListTeamBindingQuery,
  useReplaceTeamBindingMutation,
} from 'app/api/clients/iam/v0alpha1';
import { useGetResourcePermissionsQuery } from 'app/api/clients/legacy';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import userProfileImg from 'img/user_profile.png';

const PERMISSION_LEVELS = ['Member', 'Admin'];

interface TeamBindingPermissionsProps {
  teamName: string;
  canSetPermissions: boolean;
}

/** Maps a Display item to an avatar URL, falling back to a default image. */
function getAvatarUrlFromDisplay(display: Display | undefined): string {
  return display?.avatarURL || userProfileImg;
}

/** Builds display keys for the Display endpoint from team bindings. */
function buildDisplayKeys(bindings: TeamBinding[]): string[] {
  return bindings.map((b) => `user:${b.spec.subject.name}`);
}

/** Capitalizes the first letter of a permission string for display. */
function formatPermission(permission: string): string {
  return permission.charAt(0).toUpperCase() + permission.slice(1).toLowerCase();
}

export const TeamBindingPermissions = ({ teamName, canSetPermissions }: TeamBindingPermissionsProps) => {
  const styles = useStyles2(getStyles);
  const [isAdding, setIsAdding] = useState(false);

  const {
    data: bindingList,
    isLoading: bindingsLoading,
    refetch: refetchBindings,
  } = useListTeamBindingQuery({
    fieldSelector: `spec.teamRef.name=${teamName}`,
  });

  const bindings = useMemo(() => bindingList?.items ?? [], [bindingList]);

  const displayKeys = useMemo(() => buildDisplayKeys(bindings), [bindings]);

  const { data: displayData } = useGetDisplayMappingQuery(displayKeys.length > 0 ? { key: displayKeys } : skipToken);

  // Build a map from user UID to Display info
  const displayMap = useMemo(() => {
    const map = new Map<string, Display>();
    if (!displayData) {
      return map;
    }
    for (const item of displayData.display) {
      map.set(item.identity.name, item);
    }
    return map;
  }, [displayData]);

  // Fetch resource permissions from access-control API to get actions per user
  const { data: resourcePermissions } = useGetResourcePermissionsQuery({ resource: 'teams', resourceId: teamName });

  const actionsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!resourcePermissions) {
      return map;
    }
    for (const p of resourcePermissions) {
      if (p.userUid) {
        const existing = map.get(p.userUid) || [];
        map.set(p.userUid, [...new Set([...existing, ...p.actions])]);
      }
    }
    return map;
  }, [resourcePermissions]);

  const [createBinding] = useCreateTeamBindingMutation();
  const [deleteBinding] = useDeleteTeamBindingMutation();
  const [replaceBinding] = useReplaceTeamBindingMutation();

  const onAdd = async (userName: string, permission: string) => {
    await createBinding({
      teamBinding: {
        metadata: {
          name: `u.${userName}.${teamName}`,
        },
        spec: {
          subject: { kind: 'User', name: userName },
          teamRef: { name: teamName },
          permission: permission.toLowerCase(),
          external: false,
        },
      },
    });
    refetchBindings();
  };

  const onRemove = async (binding: TeamBinding) => {
    await deleteBinding({ name: binding.metadata.name! });
    refetchBindings();
  };

  const onChangePermission = async (binding: TeamBinding, newPermission: string) => {
    const currentPermission = formatPermission(binding.spec.permission);
    if (currentPermission === newPermission) {
      return;
    }
    await replaceBinding({
      name: binding.metadata.name!,
      teamBinding: {
        ...binding,
        spec: {
          ...binding.spec,
          permission: newPermission.toLowerCase(),
        },
      },
    });
    refetchBindings();
  };

  if (bindingsLoading) {
    return <LoadingPlaceholder text={t('team-binding-permissions.loading', 'Loading members...')} />;
  }

  return (
    <>
      <div>
        {bindings.length === 0 && (
          <Box>
            <Text>
              {t(
                'team-binding-permissions.empty',
                'There are no members in this team or you do not have the permissions to list the current members.'
              )}
            </Text>
          </Box>
        )}

        {bindings.length > 0 && (
          <MemberList
            bindings={bindings}
            displayMap={displayMap}
            actionsMap={actionsMap}
            canSet={canSetPermissions}
            onRemove={onRemove}
            onChange={onChangePermission}
          />
        )}

        {canSetPermissions && (
          <>
            <Button
              className={styles.addButton}
              variant="primary"
              onClick={() => setIsAdding(true)}
              icon="plus"
            >
              {t('team-binding-permissions.add-member', 'Add member')}
            </Button>
            <SlideDown in={isAdding}>
              <AddTeamMember
                onAdd={onAdd}
                onCancel={() => setIsAdding(false)}
              />
            </SlideDown>
          </>
        )}
      </div>
    </>
  );
};

interface MemberListProps {
  bindings: TeamBinding[];
  displayMap: Map<string, Display>;
  actionsMap: Map<string, string[]>;
  canSet: boolean;
  onRemove: (binding: TeamBinding) => void;
  onChange: (binding: TeamBinding, permission: string) => void;
}

const MemberList = ({ bindings, displayMap, actionsMap, canSet, onRemove, onChange }: MemberListProps) => {
  return (
    <div>
      {/* eslint-disable-next-line no-restricted-syntax -- matching existing PermissionList pattern */}
      <table className="filter-table gf-form-group">
        <thead>
          <tr>
            <th style={{ width: '1%' }} />
            <th>{t('team-binding-permissions.member', 'Member')}</th>
            <th style={{ width: '1%' }} />
            <th style={{ width: '40%' }}>{t('team-binding-permissions.permission', 'Permission')}</th>
            <th style={{ width: '1%' }} />
            <th style={{ width: '1%' }} />
          </tr>
        </thead>
        <tbody>
          {bindings.map((binding) => (
            <MemberRow
              key={binding.metadata.name}
              binding={binding}
              display={displayMap.get(binding.spec.subject.name)}
              actions={actionsMap.get(binding.spec.subject.name)}
              canSet={canSet}
              onRemove={onRemove}
              onChange={onChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface MemberRowProps {
  binding: TeamBinding;
  display: Display | undefined;
  actions: string[] | undefined;
  canSet: boolean;
  onRemove: (binding: TeamBinding) => void;
  onChange: (binding: TeamBinding, permission: string) => void;
}

const MemberRow = ({ binding, display, actions, canSet, onRemove, onChange }: MemberRowProps) => {
  const styles = useStyles2(getStyles);
  const avatarUrl = getAvatarUrlFromDisplay(display);
  const displayName = display?.displayName || binding.spec.subject.name;
  const permission = formatPermission(binding.spec.permission);
  const isExternal = binding.spec.external;

  return (
    <tr>
      <td>
        <img
          className="filter-table__avatar"
          src={avatarUrl}
          alt={t('team-binding-permissions.avatar-alt', 'Avatar for {{name}}', { name: displayName })}
        />
      </td>
      <td>
        <span>{displayName}</span>
      </td>
      <td>
        {isExternal && (
          <em className={styles.external}>
            {t('team-binding-permissions.externally-synced', 'Externally synced')}
          </em>
        )}
      </td>
      <td>
        <Select
          disabled={!canSet || isExternal}
          onChange={(v) => onChange(binding, v.value!)}
          value={PERMISSION_LEVELS.find((p) => p === permission)}
          options={PERMISSION_LEVELS.map((p) => ({ value: p, label: p }))}
        />
      </td>
      <td>
        <Tooltip
          content={
            actions?.length
              ? `${t('team-binding-permissions.actions-label', 'Actions')}: ${[...actions].sort().join(' ')}`
              : t('team-binding-permissions.no-actions', 'No actions')
          }
        >
          <Icon name="info-circle" />
        </Tooltip>
      </td>
      <td>
        {!isExternal ? (
          <Button
            size="sm"
            icon="times"
            variant="destructive"
            disabled={!canSet}
            onClick={() => onRemove(binding)}
            aria-label={t('team-binding-permissions.remove-aria', 'Remove member {{name}}', { name: displayName })}
          />
        ) : (
          <Tooltip content={t('team-binding-permissions.externally-managed', 'Externally managed member')}>
            <Button
              size="sm"
              icon="lock"
              aria-label={t('team-binding-permissions.locked-aria', 'Locked member indicator')}
            />
          </Tooltip>
        )}
      </td>
    </tr>
  );
};

interface AddTeamMemberProps {
  onAdd: (userName: string, permission: string) => void;
  onCancel: () => void;
}

const AddTeamMember = ({ onAdd, onCancel }: AddTeamMemberProps) => {
  const [userName, setUserName] = useState('');
  const [permission, setPermission] = useState(PERMISSION_LEVELS[0]);

  return (
    <div
      className="cta-form"
      aria-label={t('team-binding-permissions.add-form-aria', 'Add member form')}
    >
      <CloseButton onClick={onCancel} />
      <h5>{t('team-binding-permissions.add-title', 'Add member')}</h5>
      <form
        name="addTeamMember"
        onSubmit={(event) => {
          event.preventDefault();
          if (userName) {
            onAdd(userName, permission);
          }
        }}
      >
        <Stack gap={1} direction="row">
          <UserPicker onSelected={(u) => setUserName(u?.value?.uid || '')} />
          <Select
            aria-label={t('team-binding-permissions.permission-select-aria', 'Permission level')}
            width="auto"
            value={permission}
            options={PERMISSION_LEVELS.map((p) => ({ label: p, value: p }))}
            onChange={(v) => setPermission(v.value || PERMISSION_LEVELS[0])}
          />
          <Button type="submit" disabled={!userName}>
            {t('team-binding-permissions.save', 'Save')}
          </Button>
        </Stack>
      </form>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  addButton: css({
    marginBottom: theme.spacing(2),
  }),
  external: css({
    color: theme.colors.text.secondary,
    flexWrap: 'nowrap',
  }),
});
