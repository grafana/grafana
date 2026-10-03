import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';

import { type OrgRole } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useAppPluginMetas } from '@grafana/runtime/internal';
import { Button, ScrollContainer, Stack, TextLink, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/internal';
import { isNotDelegatable } from 'app/core/utils/roles';
import { type Role } from 'app/types/accessControl';

import { BuiltinRoleSelector } from './BuiltinRoleSelector';
import { RoleMenuGroupsSection } from './RoleMenuGroupsSection';
import { MENU_MAX_HEIGHT } from './constants';
import { getRolePickerGroup, GroupType } from './roleGroups';
import { getStyles } from './styles';

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

const roleNameCollator = new Intl.Collator();

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
  const { value: apps } = useAppPluginMetas();
  const roleGroup = (role: Role) => getRolePickerGroup(role, apps);
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

  const rolesCollection = useMemo<Record<GroupType, RolesCollectionEntry>>(() => {
    const collections: Record<GroupType, RolesCollectionEntry> = {
      fixed: { groupType: GroupType.fixed, optionGroup: [], renderedName: 'Fixed roles', roles: [] },
      custom: { groupType: GroupType.custom, optionGroup: [], renderedName: 'Custom roles', roles: [] },
      plugin: { groupType: GroupType.plugin, optionGroup: [], renderedName: 'Plugin roles', roles: [] },
    };
    for (const role of options) {
      const group = getRolePickerGroup(role, apps);
      const collection = collections[group.type];
      collection.roles.push(role);
      let optionGroup = collection.optionGroup.find((option) => option.value === group.value);
      if (!optionGroup) {
        optionGroup = {
          name: fixedRoleGroupNames[group.value] || capitalize(group.name),
          value: group.value,
          options: [],
        };
        collection.optionGroup.push(optionGroup);
      }
      optionGroup.options.push(role);
    }
    for (const collection of Object.values(collections)) {
      collection.roles.sort(sortRolesByName);
      collection.optionGroup.sort((a, b) => roleNameCollator.compare(a.name, b.name));
      collection.optionGroup.forEach((group) => group.options.sort(sortRolesByName));
    }
    return collections;
  }, [options, apps]);

  const getSelectedGroupOptions = (group: string) => {
    const selectedGroupOptions = [];
    for (const role of selectedOptions) {
      if (roleGroup(role).value === group) {
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
      const preservedGroupOptions = selectedOptions.filter((option) =>
        group.options.find((role) => role.uid === option.uid && (option.mapped || isNotDelegatable(option)))
      );
      const restOptions = selectedOptions.filter((role) => !group.options.find((option) => role.uid === option.uid));
      setSelectedOptions([...restOptions, ...preservedGroupOptions]);
    } else {
      const preservedGroupOptions = selectedOptions.filter((option) =>
        group.options.find((role) => role.uid === option.uid && (option.mapped || isNotDelegatable(option)))
      );
      const groupOptions = group.options.filter(
        (role) =>
          role.delegatable &&
          !selectedOptions.find((option) => role.uid === option.uid && (option.mapped || isNotDelegatable(option)))
      );
      const restOptions = selectedOptions.filter((role) => !group.options.find((option) => role.uid === option.uid));
      setSelectedOptions([...restOptions, ...groupOptions, ...preservedGroupOptions]);
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
      return roleGroup(role).value !== group || role.mapped || isNotDelegatable(role);
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

const sortRolesByName = (a: Role, b: Role) => roleNameCollator.compare(a.name, b.name);

const capitalize = (s: string): string => {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
};
