import { forwardRef } from 'react';

import { Portal, useStyles2, getSelectStyles, useTheme2 } from '@grafana/ui';
import { isNotDelegatable } from 'app/core/utils/roles';
import { Role } from 'app/types/accessControl';

import { InheritedRoleInfo } from './hooks';
import { RoleMenuGroupOption } from './RoleMenuGroupOption';
import { RoleMenuOption } from './RoleMenuOption';
import { RolePickerSubMenu } from './RolePickerSubMenu';
import { getStyles } from './styles';

interface RoleMenuGroupsSectionProps {
  roles: Role[];
  isFiltered?: boolean;
  renderedName: string;
  showGroups?: boolean;
  optionGroups: Array<{
    name: string;
    options: Role[];
    value: string;
  }>;
  onGroupChange: (value: string) => void;
  groupSelected: (group: string) => boolean;
  groupPartiallySelected: (group: string) => boolean;
  disabled?: boolean;
  subMenuNode?: HTMLDivElement;
  selectedOptions: Role[];
  onRoleChange: (option: Role) => void;
  onClearSubMenu: (group: string) => void;
  showOnLeftSubMenu?: boolean;
  /** Map of role UID → inherited role info (greyed out, not interactive) */
  inheritedRoles?: Map<string, InheritedRoleInfo>;
  /** Which group value is currently open (controlled by parent), undefined = none */
  openedGroupValue?: string;
  /** Callback to toggle a group's submenu (parent manages cross-section exclusivity) */
  onToggleSubmenu: (value: string) => void;
}

export const RoleMenuGroupsSection = forwardRef<HTMLDivElement, RoleMenuGroupsSectionProps>(
  (
    {
      roles,
      isFiltered,
      renderedName,
      showGroups,
      optionGroups,
      onGroupChange,
      groupSelected,
      groupPartiallySelected,
      subMenuNode,
      selectedOptions,
      onRoleChange,
      onClearSubMenu,
      showOnLeftSubMenu,
      inheritedRoles,
      openedGroupValue,
      onToggleSubmenu,
    },
    _ref
  ) => {
    const theme = useTheme2();
    const selectStyles = getSelectStyles(theme);
    const styles = useStyles2(getStyles);

    // Find the currently-open group (controlled by parent for cross-section exclusivity)
    const activeGroup = openedGroupValue && showGroups
      ? optionGroups?.find((g) => g.value === openedGroupValue)
      : undefined;

    return (
      <div>
        {roles.length > 0 && (
          <div className={styles.menuSection}>
            <div className={styles.groupHeader}>{renderedName}</div>
            <div className={selectStyles.optionBody}></div>
            {showGroups && !!optionGroups?.length
              ? optionGroups.map((groupOption) => {
                  // Compute inherited role count and sources for this group
                  let groupInheritedCount = 0;
                  const groupSources = new Set<string>();
                  if (inheritedRoles) {
                    for (const option of groupOption.options) {
                      const info = inheritedRoles.get(option.uid);
                      if (info) {
                        groupInheritedCount++;
                        info.sources.forEach((s) => groupSources.add(s));
                      }
                    }
                  }
                  const allInherited = groupInheritedCount > 0 && groupInheritedCount >= groupOption.options.length;
                  const inheritedLabel = groupInheritedCount > 0
                    ? `(${groupInheritedCount} via ${[...groupSources].join(' + ')})`
                    : undefined;

                  return (
                  <RoleMenuGroupOption
                    key={groupOption.value}
                    name={groupOption.name}
                    value={groupOption.value}
                    isSelected={groupSelected(groupOption.value) || groupPartiallySelected(groupOption.value)}
                    partiallySelected={groupPartiallySelected(groupOption.value)}
                    disabled={allInherited || groupOption.options?.every(
                      (option) =>
                        isNotDelegatable(option) || selectedOptions.find((opt) => opt.uid === option.uid && opt.mapped)
                    )}
                    onChange={onGroupChange}
                    onToggleSubMenu={onToggleSubmenu}
                    isFocused={openedGroupValue === groupOption.value}
                    inheritedLabel={inheritedLabel}
                    allInherited={allInherited}
                  />
                  );
                })
              : roles.map((option) => {
                  const inheritedInfo = inheritedRoles?.get(option.uid);
                  return (
                    <RoleMenuOption
                      useFilteredDisplayName={isFiltered}
                      data={option}
                      key={option.uid}
                      isSelected={!!(option.uid && !!selectedOptions.find((opt) => opt.uid === option.uid))}
                      disabled={isNotDelegatable(option)}
                      mapped={!!(option.uid && selectedOptions.find((opt) => opt.uid === option.uid && opt.mapped))}
                      onChange={onRoleChange}
                      hideDescription
                      inherited={!!inheritedInfo}
                      inheritedSources={inheritedInfo?.sources}
                    />
                  );
                })}
          </div>
        )}
        {/* Render submenu once outside the map to prevent remounting on selection changes */}
        {activeGroup && subMenuNode && (
          <Portal className={styles.subMenuPortal} root={subMenuNode}>
            <RolePickerSubMenu
              options={activeGroup.options}
              selectedOptions={selectedOptions}
              onSelect={onRoleChange}
              onClear={() => onClearSubMenu(openedGroupValue!)}
              showOnLeft={showOnLeftSubMenu}
              inheritedRoles={inheritedRoles}
            />
          </Portal>
        )}
      </div>
    );
  }
);

RoleMenuGroupsSection.displayName = 'RoleMenuGroupsSection';
