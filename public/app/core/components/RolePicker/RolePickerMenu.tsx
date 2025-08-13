import { css, cx } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { OrgRole } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ScrollContainer, Stack, TextLink, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/internal';
import { Role } from 'app/types/accessControl';

import { BuiltinRoleSelector } from './BuiltinRoleSelector';
import { RoleMenuGroupsSection } from './RoleMenuGroupsSection';
import { MENU_MAX_HEIGHT } from './constants';
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
    You can now select the &quot;No basic role&quot; option and add permissions to your custom needs. You can find more
    information in&nbsp;
    <TextLink
      href="https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/#organization-roles"
      variant="bodySmall"
      external
    >
      our documentation
    </TextLink>
    .
  </Trans>
);

interface RolePickerMenuProps {
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
  offset: { vertical: number; horizontal: number };
  menuLeft?: boolean;
}

export const RolePickerMenu = ({
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
  offset,
  menuLeft,
  apply,
}: RolePickerMenuProps): JSX.Element => {
  const [selectedOptions, setSelectedOptions] = useState<Role[]>(appliedRoles);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<OrgRole | undefined>(basicRole);
  const [rolesCollection, setRolesCollection] = useState<{ [key: string]: RolesCollectionEntry }>({});
  const subMenuNode = useRef<HTMLDivElement | null>(null);
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
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

  const groupSelected = (groupType: GroupType, group: string) => {
    const selectedGroupOptions = getSelectedGroupOptions(group);
    const groupOptions = rolesCollection[groupType]?.optionGroup.find((g) => g.value === group);
    return selectedGroupOptions.length > 0 && selectedGroupOptions.length >= groupOptions!.options.length;
  };

  const groupPartiallySelected = (groupType: GroupType, group: string) => {
    const selectedGroupOptions = getSelectedGroupOptions(group);
    const groupOptions = rolesCollection[groupType]?.optionGroup.find((g) => g.value === group);
    return selectedGroupOptions.length > 0 && selectedGroupOptions.length < groupOptions!.options.length;
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
    const options = selectedOptions.filter((role) => {
      const roleGroup = getRoleGroup(role);
      return roleGroup !== group || role.mapped;
    });
    setSelectedOptions(options);
  };

  const onUpdateInternal = () => {
    onUpdate(selectedOptions, selectedBuiltInRole);
  };

  return (
    <div
      className={cx(
        styles.menu,
        customStyles.menuWrapper,
        { [customStyles.menuLeft]: menuLeft },
        css({
          top: `${offset.vertical}px`,
          left: !menuLeft ? `${offset.horizontal}px` : 'unset',
          right: menuLeft ? `${offset.horizontal}px` : 'unset',
        })
      )}
    >
      <div className={customStyles.menu} aria-label={t('role-picker.menu-aria-label', 'Role picker menu')}>
        <ScrollContainer
          maxHeight={`${MENU_MAX_HEIGHT}px`}
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
              showOnLeftSubMenu={menuLeft}
            />
          ))}
        </ScrollContainer>
        <div className={customStyles.menuButtonRow}>
          <Stack justifyContent="flex-end">
            <Button size="sm" fill="text" onClick={onClearInternal} disabled={updateDisabled}>
              <Trans i18nKey="role-picker.menu.clear-button">Clear all</Trans>
            </Button>
            <Button size="sm" onClick={onUpdateInternal} disabled={updateDisabled}>
              {apply ? `Apply` : `Update`}
            </Button>
          </Stack>
        </div>
      </div>
      <div ref={subMenuNode} />
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
