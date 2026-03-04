import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';

import { Permission } from '@grafana/api-clients/rtkq/legacy';
import { OrgRole } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, IconButton, ScrollContainer, Stack, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { Role } from 'app/types/accessControl';

import { BuiltinRoleSelector } from './BuiltinRoleSelector';
import { InheritedRoleInfo, fetchRoleDetail } from './hooks';
import { RoleMenuGroupsSection } from './RoleMenuGroupsSection';
import { getStyles } from './styles';

enum GroupType {
  fixed = 'fixed',
  custom = 'custom',
  plugin = 'plugin',
}

interface RoleGroupOption {
  name: string;
  value: string;
  options: Role[];
}

interface RolesCollectionEntry {
  groupType: GroupType;
  optionGroup: RoleGroupOption[];
  renderedName: string;
  roles: Role[];
}

const fixedRoleGroupNames: Record<string, string> = {
  ldap: 'LDAP',
  current: 'Current org',
};

const tooltipMessage = (
  <Trans i18nKey="role-picker.menu.tooltip">
    Viewer, Editor, and Admin are cumulative &mdash; Editor includes everything in Viewer plus more, Admin includes
    everything in Editor plus more. Select &quot;No basic role&quot; to start from zero and build up with custom
    roles.&nbsp;
    <TextLink
      href="https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/"
      variant="bodySmall"
      external
    >
      View role definitions
    </TextLink>
  </Trans>
);

export interface RolePickerContentProps {
  basicRole?: OrgRole;
  options: Role[];
  isFiltered?: boolean;
  appliedRoles: Role[];
  showGroups?: boolean;
  basicRoleDisabled?: boolean;
  disabledMessage?: string;
  showBasicRole?: boolean;
  onSelect: (roles: Role[]) => void;
  onBasicRoleSelect?: (role: OrgRole) => void;
  onUpdate: (newRoles: Role[], newBuiltInRole?: OrgRole) => void;
  updateDisabled?: boolean;
  apply?: boolean;
  /** Map of role UID → inherited role info (greyed out, not interactive) */
  inheritedRoles?: Map<string, InheritedRoleInfo>;
  /** Permissions from basic/custom roles that don't map to any named role */
  orphanPermissions?: Permission[];
  /** Max height for scrollable content area. Omit for no constraint (e.g. in a Drawer). */
  maxHeight?: string;
  /** Show submenu to the left of the main menu */
  showOnLeftSubMenu?: boolean;
}

export const RolePickerContent = ({
  basicRole,
  options,
  isFiltered,
  appliedRoles,
  showGroups,
  basicRoleDisabled,
  disabledMessage,
  showBasicRole,
  onSelect,
  onBasicRoleSelect,
  onUpdate,
  updateDisabled,
  apply,
  inheritedRoles,
  orphanPermissions,
  maxHeight,
  showOnLeftSubMenu = false,
}: RolePickerContentProps): JSX.Element => {
  const [selectedOptions, setSelectedOptions] = useState<Role[]>(appliedRoles);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<OrgRole | undefined>(basicRole);
  const [rolesCollection, setRolesCollection] = useState<{ [key: string]: RolesCollectionEntry }>({});
  const [allPermsCopied, setAllPermsCopied] = useState(false);
  // Submenu state lifted here so only one submenu is open across all sections
  const [openSubmenu, setOpenSubmenu] = useState<{ sectionKey: string; groupValue: string } | null>(null);
  const subMenuNode = useRef<HTMLDivElement | null>(null);
  const customStyles = useStyles2(getStyles);

  // Call onSelect() on every selectedOptions change
  useEffect(() => {
    onSelect(selectedOptions);
  }, [selectedOptions, onSelect]);

  useEffect(() => {
    if (onBasicRoleSelect && selectedBuiltInRole) {
      onBasicRoleSelect(selectedBuiltInRole);
    }
  }, [selectedBuiltInRole, onBasicRoleSelect]);

  // Evaluate rolesCollection only if options changed, otherwise
  // it triggers unnecessary re-rendering of <RoleMenuGroupsSection /> component
  useEffect(() => {
    const customRoles = options.filter(filterCustomRoles).sort(sortRolesByName);
    const fixedRoles = options.filter(filterFixedRoles).sort(sortRolesByName);
    const pluginRoles = options.filter(filterPluginsRoles).sort(sortRolesByName);
    const optionGroups = {
      fixed: convertRolesToGroupOptions(fixedRoles).sort((a, b) => a.name.localeCompare(b.name)),
      custom: convertRolesToGroupOptions(customRoles).sort((a, b) => a.name.localeCompare(b.name)),
      plugin: convertRolesToGroupOptions(pluginRoles).sort((a, b) => a.name.localeCompare(b.name)),
    };

    setRolesCollection({
      fixed: {
        groupType: GroupType.fixed,
        optionGroup: optionGroups.fixed,
        renderedName: `Fixed roles`,
        roles: fixedRoles,
      },
      custom: {
        groupType: GroupType.custom,
        optionGroup: optionGroups.custom,
        renderedName: `Custom roles`,
        roles: customRoles,
      },
      plugin: {
        groupType: GroupType.plugin,
        optionGroup: optionGroups.plugin,
        renderedName: `Plugin roles`,
        roles: pluginRoles,
      },
    });
  }, [options]);

  const getSelectedGroupOptions = (group: string) => {
    const selectedGroupOptions = [];
    for (const role of selectedOptions) {
      if (getRoleGroup(role) === group) {
        selectedGroupOptions.push(role);
      }
    }
    return selectedGroupOptions;
  };

  // Count roles in a group that are either explicitly selected or inherited
  const getEffectiveGroupCount = (group: string, groupOptions: Role[]): number => {
    const selectedUids = new Set(selectedOptions.filter((r) => getRoleGroup(r) === group).map((r) => r.uid));
    let count = selectedUids.size;
    if (inheritedRoles) {
      for (const option of groupOptions) {
        if (!selectedUids.has(option.uid) && inheritedRoles.has(option.uid)) {
          count++;
        }
      }
    }
    return count;
  };

  const groupSelected = (groupType: GroupType, group: string) => {
    const groupOption = rolesCollection[groupType]?.optionGroup.find((g) => g.value === group);
    if (!groupOption) {
      return false;
    }
    const effectiveCount = getEffectiveGroupCount(group, groupOption.options);
    return effectiveCount > 0 && effectiveCount >= groupOption.options.length;
  };

  const groupPartiallySelected = (groupType: GroupType, group: string) => {
    const groupOption = rolesCollection[groupType]?.optionGroup.find((g) => g.value === group);
    if (!groupOption) {
      return false;
    }
    const effectiveCount = getEffectiveGroupCount(group, groupOption.options);
    return effectiveCount > 0 && effectiveCount < groupOption.options.length;
  };

  const changeableGroupRolesSelected = (groupType: GroupType, group: string) => {
    const selectedGroupOptions = getSelectedGroupOptions(group);
    const changeableGroupOptions = selectedGroupOptions.filter((role) => role.delegatable && !role.mapped);
    const groupOptions = rolesCollection[groupType]?.optionGroup.find((g) => g.value === group);
    return changeableGroupOptions.length > 0 && changeableGroupOptions.length < groupOptions!.options.length;
  };

  const onChange = (option: Role) => {
    if (selectedOptions.find((role) => role.uid === option.uid && !role.mapped)) {
      setSelectedOptions(selectedOptions.filter((role) => role.uid !== option.uid));
    } else {
      setSelectedOptions([...selectedOptions, option]);
    }
  };

  const onGroupChange = (groupType: GroupType, value: string) => {
    const group = rolesCollection[groupType]?.optionGroup.find((g) => {
      return g.value === value;
    });

    if (!group) {
      return;
    }

    if (groupSelected(groupType, value) || changeableGroupRolesSelected(groupType, value)) {
      const mappedGroupOptions = selectedOptions.filter((option) =>
        group.options.find((role) => role.uid === option.uid && option.mapped)
      );
      const restOptions = selectedOptions.filter((role) => !group.options.find((option) => role.uid === option.uid));
      setSelectedOptions([...restOptions, ...mappedGroupOptions]);
    } else {
      const mappedGroupOptions = selectedOptions.filter((option) =>
        group.options.find((role) => role.uid === option.uid && role.delegatable)
      );
      const groupOptions = group.options.filter(
        (role) => role.delegatable && !selectedOptions.find((option) => role.uid === option.uid && option.mapped)
      );
      const restOptions = selectedOptions.filter((role) => !group.options.find((option) => role.uid === option.uid));
      setSelectedOptions([...restOptions, ...groupOptions, ...mappedGroupOptions]);
    }
  };

  const onSelectedBuiltinRoleChange = (newRole: OrgRole) => {
    setSelectedBuiltInRole(newRole);
  };

  const onClearInternal = async () => {
    const mappedRoles = selectedOptions.filter((role) => role.mapped);
    const nonDelegatableRoles = options.filter((role) =>
      selectedOptions.find((option) => role.uid === option.uid && !role.delegatable)
    );
    setSelectedOptions([...mappedRoles, ...nonDelegatableRoles]);
  };

  const onClearSubMenu = (group: string) => {
    const opts = selectedOptions.filter((role) => {
      const roleGroup = getRoleGroup(role);
      return roleGroup !== group || role.mapped;
    });
    setSelectedOptions(opts);
  };

  const onUpdateInternal = () => {
    onUpdate(selectedOptions, selectedBuiltInRole);
  };

  const onToggleSubmenu = useCallback((sectionKey: string, groupValue: string) => {
    setOpenSubmenu((prev) => {
      if (prev?.sectionKey === sectionKey && prev?.groupValue === groupValue) {
        return null; // close if clicking same group
      }
      return { sectionKey, groupValue };
    });
  }, []);

  const onCopyAllPermissions = useCallback(async () => {
    const allPerms = new Map<string, Permission>();

    // 1. Basic role permissions
    if (selectedBuiltInRole && selectedBuiltInRole !== OrgRole.None) {
      const basicRoleUid = `basic_${selectedBuiltInRole.toLowerCase()}`;
      try {
        const detail = await fetchRoleDetail(basicRoleUid);
        for (const p of detail.permissions || []) {
          allPerms.set(`${p.action}|${p.scope || ''}`, p);
        }
      } catch (e) {
        console.warn('Failed to fetch basic role permissions:', e);
      }
    }

    // 2. Explicitly selected role permissions
    for (const role of selectedOptions) {
      try {
        const detail = await fetchRoleDetail(role.uid);
        for (const p of detail.permissions || []) {
          allPerms.set(`${p.action}|${p.scope || ''}`, p);
        }
      } catch (e) {
        console.warn('Failed to fetch role permissions:', role.name, e);
      }
    }

    // 3. Include orphan permissions (should already be in basic role, but ensure completeness)
    if (orphanPermissions) {
      for (const p of orphanPermissions) {
        allPerms.set(`${p.action}|${p.scope || ''}`, p);
      }
    }

    const sorted = [...allPerms.values()].sort((a, b) => (a.action || '').localeCompare(b.action || ''));
    const json = JSON.stringify(
      sorted.map((p) => ({ action: p.action, scope: p.scope || '' })),
      null,
      2
    );

    await navigator.clipboard.writeText(json);
    setAllPermsCopied(true);
    setTimeout(() => setAllPermsCopied(false), 2000);
  }, [selectedBuiltInRole, selectedOptions, orphanPermissions]);

  const scrollProps = maxHeight ? { maxHeight } : {};

  return (
    <div className={customStyles.menu} aria-label={t('role-picker.menu-aria-label', 'Role picker menu')}>
      <ScrollContainer
        {...scrollProps}
        // NOTE: this is a way to force hiding of the scrollbar
        // the scrollbar makes the mouseEvents drop
        scrollbarWidth="none"
      >
        {showBasicRole && (
          <div className={customStyles.menuSection}>
            <BuiltinRoleSelector
              value={selectedBuiltInRole}
              onChange={onSelectedBuiltinRoleChange}
              disabled={basicRoleDisabled}
              disabledMesssage={disabledMessage}
              tooltipMessage={tooltipMessage}
            />
          </div>
        )}
        {Object.entries(rolesCollection).map(([groupId, collection]) => (
          <RoleMenuGroupsSection
            key={groupId}
            roles={collection.roles}
            isFiltered={isFiltered}
            renderedName={collection.renderedName}
            showGroups={showGroups}
            optionGroups={collection.optionGroup}
            groupSelected={(group: string) => groupSelected(collection.groupType, group)}
            groupPartiallySelected={(group: string) => groupPartiallySelected(collection.groupType, group)}
            onGroupChange={(group: string) => onGroupChange(collection.groupType, group)}
            subMenuNode={subMenuNode?.current!}
            selectedOptions={selectedOptions}
            onRoleChange={onChange}
            onClearSubMenu={onClearSubMenu}
            showOnLeftSubMenu={showOnLeftSubMenu}
            inheritedRoles={inheritedRoles}
            openedGroupValue={openSubmenu?.sectionKey === groupId ? openSubmenu.groupValue : undefined}
            onToggleSubmenu={(groupValue: string) => onToggleSubmenu(groupId, groupValue)}
          />
        ))}
        {orphanPermissions && orphanPermissions.length > 0 && (
          <OrphanPermissionsSection permissions={orphanPermissions} />
        )}
      </ScrollContainer>
      <div className={customStyles.menuButtonRow}>
        <Stack justifyContent="space-between">
          <Tooltip content={allPermsCopied ? 'Copied!' : 'Copy all applied/selected permissions as JSON'}>
            <IconButton
              name={allPermsCopied ? 'check' : 'copy'}
              size="sm"
              onClick={onCopyAllPermissions}
              aria-label="Copy all applied and selected permissions as JSON"
            />
          </Tooltip>
          <Stack gap={1}>
            <Button size="sm" fill="text" onClick={onClearInternal} disabled={updateDisabled}>
              <Trans i18nKey="role-picker.menu.clear-button">Clear all</Trans>
            </Button>
            <Button size="sm" onClick={onUpdateInternal} disabled={updateDisabled}>
              {apply ? `Apply` : `Update`}
            </Button>
          </Stack>
        </Stack>
      </div>
      <div ref={subMenuNode} />
    </div>
  );
};

/**
 * Formats a permission into a single human-readable line.
 */
function formatOrphanPermission(perm: Permission): string {
  const action = perm.action || '';
  const colonIdx = action.lastIndexOf(':');
  const domain = colonIdx > 0 ? action.substring(0, colonIdx) : action;
  const verb = colonIdx > 0 ? action.substring(colonIdx + 1) : action;

  const cleanDomain = domain
    .replace(/^grafana-/, '')
    .replace(/[.\-_]/g, ' ')
    .trim();

  const capVerb = verb.charAt(0).toUpperCase() + verb.slice(1);
  let line = `${capVerb} ${cleanDomain}`;

  // Only show scope when it's specific (not wildcard)
  const scope = perm.scope || '';
  if (scope && scope !== '' && scope !== '*' && !scope.endsWith(':*')) {
    let cleanScope = scope;
    if (scope === 'folders:uid:general') {
      cleanScope = 'root level';
    } else if (scope.startsWith('folders:uid:')) {
      cleanScope = scope.replace('folders:uid:', '');
      cleanScope = cleanScope.charAt(0).toUpperCase() + cleanScope.slice(1) + ' folder';
    } else if (scope === 'datasources:uid:grafana') {
      cleanScope = 'built-in Grafana datasource';
    } else if (scope.startsWith('datasources:uid:')) {
      cleanScope = scope.replace('datasources:uid:', '') + ' datasource';
    }
    line += `: ${cleanScope}`;
  }

  return line;
}

/**
 * Shows permissions from basic/custom roles that don't map to any named fixed/plugin role.
 */
const OrphanPermissionsSection = ({ permissions }: { permissions: Permission[] }) => {
  const customStyles = useStyles2(getStyles);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCopyJson = useCallback(() => {
    const json = JSON.stringify(
      permissions.map((p) => ({ action: p.action, scope: p.scope || '' })),
      null,
      2
    );
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [permissions]);

  const sorted = useMemo(
    () => [...permissions].sort((a, b) => (a.action || '').localeCompare(b.action || '')),
    [permissions]
  );

  return (
    <div className={customStyles.orphanSection}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={customStyles.orphanHeader}
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <Icon name={isExpanded ? 'angle-down' : 'angle-right'} size="sm" />
        <span style={{ marginLeft: '4px' }}>
          Additional permissions ({permissions.length})
        </span>
      </div>
      {isExpanded && (
        <div className={customStyles.permissionsAccordion}>
          <div className={customStyles.permissionsHeader}>
            <span className={customStyles.permissionsCount}>
              {permissions.length} permissions not mapped to named roles
            </span>
            <Tooltip content={copied ? 'Copied!' : 'Copy as JSON'}>
              <IconButton
                name={copied ? 'check' : 'copy'}
                size="sm"
                onClick={onCopyJson}
                aria-label="Copy orphan permissions as JSON"
              />
            </Tooltip>
          </div>
          {sorted.map((perm, i) => (
            <div key={i} className={customStyles.permissionRow}>
              {formatOrphanPermission(perm)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const filterCustomRoles = (option: Role) => !option.name?.startsWith('fixed:') && !option.name.startsWith('plugins:');
const filterFixedRoles = (option: Role) => option.name?.startsWith('fixed:');
const filterPluginsRoles = (option: Role) => option.name?.startsWith('plugins:');

interface GroupsMap {
  [key: string]: { roles: Role[]; name: string };
}

const convertRolesToGroupOptions = (roles: Role[]) => {
  const groupsMap: GroupsMap = {};
  roles.forEach((role) => {
    const groupId = getRoleGroup(role);
    const groupName = getRoleGroupName(role);
    if (!groupsMap[groupId]) {
      groupsMap[groupId] = { name: groupName, roles: [] };
    }
    groupsMap[groupId].roles.push(role);
  });
  const groups = Object.entries(groupsMap).map(([groupId, groupEntry]) => {
    return {
      name: fixedRoleGroupNames[groupId] || capitalize(groupEntry.name),
      value: groupId,
      options: groupEntry.roles.sort(sortRolesByName),
    };
  });
  return groups;
};

const getRoleGroup = (role: Role) => {
  const prefix = getRolePrefix(role);
  const name = getRoleGroupName(role);
  return `${prefix}:${name}`;
};

const getRoleGroupName = (role: Role) => {
  return role.group || 'Other';
};

const getRolePrefix = (role: Role) => {
  const prefixEnd = role.name.indexOf(':');
  if (prefixEnd < 0) {
    return 'unknown';
  }
  return role.name.substring(0, prefixEnd);
};

const sortRolesByName = (a: Role, b: Role) => a.name.localeCompare(b.name);

const capitalize = (s: string): string => {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
};
