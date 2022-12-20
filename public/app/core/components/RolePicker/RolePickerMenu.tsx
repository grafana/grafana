import { css, cx } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { SelectableValue } from '@grafana/data';
import { Button, CustomScrollbar, HorizontalGroup, RadioButtonGroup, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { OrgRole, Role } from 'app/types';

import { RoleMenuGroupsSection } from './RoleMenuGroupsSection';
import { MENU_MAX_HEIGHT } from './constants';
import { getStyles } from './styles';

enum GroupType {
  fixed = 'fixed',
  custom = 'custom',
  plugin = 'plugin',
}

const BasicRoles = Object.values(OrgRole);
const BasicRoleOption: Array<SelectableValue<OrgRole>> = BasicRoles.map((r) => ({
  label: r,
  value: r,
}));

const fixedRoleGroupNames: Record<string, string> = {
  ldap: 'LDAP',
  current: 'Current org',
};

interface RolePickerMenuProps {
  basicRole?: OrgRole;
  options: Role[];
  appliedRoles: Role[];
  showGroups?: boolean;
  basicRoleDisabled?: boolean;
  showBasicRole?: boolean;
  onSelect: (roles: Role[]) => void;
  onBasicRoleSelect?: (role: OrgRole) => void;
  onUpdate: (newRoles: Role[], newBuiltInRole?: OrgRole) => void;
  updateDisabled?: boolean;
  apply?: boolean;
  offset: { vertical: number; horizontal: number };
}

export const RolePickerMenu = ({
  basicRole,
  options,
  appliedRoles,
  showGroups,
  basicRoleDisabled,
  showBasicRole,
  onSelect,
  onBasicRoleSelect,
  onUpdate,
  updateDisabled,
  offset,
  apply,
}: RolePickerMenuProps): JSX.Element => {
  const [selectedOptions, setSelectedOptions] = useState<Role[]>(appliedRoles);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<OrgRole | undefined>(basicRole);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [openedMenuGroup, setOpenedMenuGroup] = useState('');
  const [subMenuOptions, setSubMenuOptions] = useState<Role[]>([]);
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

  const customRoles = options.filter(filterCustomRoles).sort(sortRolesByName);
  const fixedRoles = options.filter(filterFixedRoles).sort(sortRolesByName);
  const pluginRoles = options.filter(filterPluginsRoles).sort(sortRolesByName);
  const optionGroups = {
    fixed: convertRolesToGroupOptions(fixedRoles).sort((a, b) => a.name.localeCompare(b.name)),
    custom: convertRolesToGroupOptions(customRoles).sort((a, b) => a.name.localeCompare(b.name)),
    plugin: convertRolesToGroupOptions(pluginRoles).sort((a, b) => a.name.localeCompare(b.name)),
  };

  const rolesCollection = {
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
    pluginRoles: {
      groupType: GroupType.plugin,
      optionGroup: optionGroups.plugin,
      renderedName: `Plugin roles`,
      roles: pluginRoles,
    },
  };

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
    const groupOptions = optionGroups[groupType].find((g) => g.value === group);
    return selectedGroupOptions.length > 0 && selectedGroupOptions.length >= groupOptions!.options.length;
  };

  const groupPartiallySelected = (groupType: GroupType, group: string) => {
    const selectedGroupOptions = getSelectedGroupOptions(group);
    const groupOptions = optionGroups[groupType].find((g) => g.value === group);
    return selectedGroupOptions.length > 0 && selectedGroupOptions.length < groupOptions!.options.length;
  };

  const onChange = (option: Role) => {
    if (selectedOptions.find((role) => role.uid === option.uid)) {
      setSelectedOptions(selectedOptions.filter((role) => role.uid !== option.uid));
    } else {
      setSelectedOptions([...selectedOptions, option]);
    }
  };

  const onGroupChange = (groupType: GroupType, value: string) => {
    const group = optionGroups[groupType].find((g) => {
      return g.value === value;
    });

    if (!group) {
      return;
    }

    if (groupSelected(groupType, value) || groupPartiallySelected(groupType, value)) {
      setSelectedOptions(selectedOptions.filter((role) => !group.options.find((option) => role.uid === option.uid)));
    } else {
      const groupOptions = group.options.filter((role) => role.delegatable);
      const restOptions = selectedOptions.filter((role) => !group.options.find((option) => role.uid === option.uid));
      setSelectedOptions([...restOptions, ...groupOptions]);
    }
  };

  const onOpenSubMenu = (groupType: GroupType, value: string) => {
    setOpenedMenuGroup(value);
    setShowSubMenu(true);
    const group = optionGroups[groupType].find((g) => {
      return g.value === value;
    });
    if (group) {
      setSubMenuOptions(group.options);
    }
  };

  const onCloseSubMenu = (value: string) => {
    setShowSubMenu(false);
    setOpenedMenuGroup('');
    setSubMenuOptions([]);
  };

  const onSelectedBuiltinRoleChange = (newRole: OrgRole) => {
    setSelectedBuiltInRole(newRole);
  };

  const onClearInternal = async () => {
    setSelectedOptions([]);
  };

  const onClearSubMenu = () => {
    const options = selectedOptions.filter((role) => {
      const groupName = getRoleGroup(role);
      return groupName !== openedMenuGroup;
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
        { [customStyles.menuLeft]: offset.horizontal > 0 },
        css`
          bottom: ${offset.vertical > 0 ? `${offset.vertical}px` : 'unset'};
          top: ${offset.vertical < 0 ? `${Math.abs(offset.vertical)}px` : 'unset'};
        `
      )}
    >
      <div className={customStyles.menu} aria-label="Role picker menu">
        <CustomScrollbar autoHide={false} autoHeightMax={`${MENU_MAX_HEIGHT}px`} hideHorizontalTrack hideVerticalTrack>
          {showBasicRole && (
            <div className={customStyles.menuSection}>
              <div className={customStyles.groupHeader}>Basic roles</div>
              <RadioButtonGroup
                className={customStyles.basicRoleSelector}
                options={BasicRoleOption}
                value={selectedBuiltInRole}
                onChange={onSelectedBuiltinRoleChange}
                fullWidth={true}
                disabled={basicRoleDisabled}
              />
            </div>
          )}
          {Object.entries(rolesCollection).map(([groupId, collection]) => {
            return (
              <RoleMenuGroupsSection
                key={groupId}
                roles={collection.roles}
                renderedName={collection.renderedName}
                menuSectionStyle={customStyles.menuSection}
                groupHeaderStyle={customStyles.groupHeader}
                optionBodyStyle={styles.optionBody}
                showGroups={showGroups}
                optionGroups={collection.optionGroup}
                groupSelected={(group: string) => groupSelected(collection.groupType, group)}
                groupPartiallySelected={(group: string) => groupPartiallySelected(collection.groupType, group)}
                onChange={(group: string) => onGroupChange(collection.groupType, group)}
                onOpenSubMenuRMGS={(group: string) => onOpenSubMenu(collection.groupType, group)}
                onCloseSubMenu={onCloseSubMenu}
                subMenuNode={subMenuNode?.current!}
                showSubMenu={showSubMenu}
                openedMenuGroup={openedMenuGroup}
                subMenuOptions={subMenuOptions}
                selectedOptions={selectedOptions}
                onChangeSubMenu={onChange}
                onClearSubMenu={onClearSubMenu}
                showOnLeftSubMenu={offset.horizontal > 0}
              ></RoleMenuGroupsSection>
            );
          })}
        </CustomScrollbar>
        <div className={customStyles.menuButtonRow}>
          <HorizontalGroup justify="flex-end">
            <Button size="sm" fill="text" onClick={onClearInternal} disabled={updateDisabled}>
              Clear all
            </Button>
            <Button size="sm" onClick={onUpdateInternal} disabled={updateDisabled}>
              {apply ? `Apply` : `Update`}
            </Button>
          </HorizontalGroup>
        </div>
      </div>
      <div ref={subMenuNode} />
    </div>
  );
};

const filterCustomRoles = (option: Role) => !option.name?.startsWith('fixed:') && !option.name.startsWith('plugins:');
const filterFixedRoles = (option: Role) => option.name?.startsWith('fixed:');
const filterPluginsRoles = (option: Role) => option.name?.startsWith('plugins:');

const convertRolesToGroupOptions = (roles: Role[]) => {
  const groupsMap: { [key: string]: Role[] } = {};
  roles.forEach((role) => {
    const groupName = getRoleGroup(role);
    if (!groupsMap[groupName]) {
      groupsMap[groupName] = [];
    }
    groupsMap[groupName].push(role);
  });
  const groups = Object.entries(groupsMap).map(([groupName, roles]) => {
    return {
      name: fixedRoleGroupNames[groupName] || capitalize(groupName),
      value: groupName,
      options: roles.sort(sortRolesByName),
      uid: uuidv4(),
    };
  });
  return groups;
};

const getRoleGroup = (role: Role) => {
  return role.group || 'Other';
};

const sortRolesByName = (a: Role, b: Role) => a.name.localeCompare(b.name);

const capitalize = (s: string): string => {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
};
