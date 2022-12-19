import React from 'react';

import { Role } from 'app/types';

import { RoleMenuGroupOption } from './RoleMenuGroupOption';
import { RoleMenuOption } from './RoleMenuOption';
import { RolePickerSubMenu } from './RolePickerSubMenu';
import { isNotDelegatable } from './utils';

interface RoleMenuGroupsSectionProps {
  roles: Role[];
  renderedName: string;
  menuSectionStyle: string;
  groupHeaderStyle: string;
  optionBodyStyle: string;
  showGroups?: boolean;
  optionGroups: Array<{
    name: string;
    options: Role[];
    value: string;
  }>;
  onChange: (value: string) => void;
  onOpenSubMenuRMGS: (value: string) => void;
  onCloseSubMenu?: (value: string) => void;
  groupSelected: (group: string) => boolean;
  groupPartiallySelected: (group: string) => boolean;
  disabled?: boolean;
  subMenuNode?: HTMLDivElement;
  showSubMenu: boolean;
  openedMenuGroup: string;
  subMenuOptions: Role[];
  selectedOptions: Role[];
  onChangeSubMenu: (option: Role) => void;
  onClearSubMenu: () => void;
  showOnLeftSubMenu: boolean;
}

export const RoleMenuGroupsSection = React.forwardRef<HTMLDivElement, RoleMenuGroupsSectionProps>(
  (
    {
      roles,
      renderedName,
      menuSectionStyle,
      groupHeaderStyle,
      optionBodyStyle,
      showGroups,
      optionGroups,
      onChange,
      groupSelected,
      groupPartiallySelected,
      onOpenSubMenuRMGS,
      onCloseSubMenu,
      subMenuNode,
      showSubMenu,
      openedMenuGroup,
      subMenuOptions,
      selectedOptions,
      onChangeSubMenu,
      onClearSubMenu,
      showOnLeftSubMenu,
    },
    _ref
  ) => {
    return (
      <div>
        {roles.length > 0 && (
          <div className={menuSectionStyle}>
            <div className={groupHeaderStyle}>{renderedName}</div>
            <div className={optionBodyStyle}></div>
            {showGroups && !!optionGroups?.length
              ? optionGroups.map((groupOption) => (
                  <RoleMenuGroupOption
                    data={groupOption}
                    key={groupOption.value}
                    isSelected={groupSelected(groupOption.value) || groupPartiallySelected(groupOption.value)}
                    partiallySelected={groupPartiallySelected(groupOption.value)}
                    disabled={groupOption.options?.every(isNotDelegatable)}
                    onChange={onChange}
                    onOpenSubMenu={onOpenSubMenuRMGS}
                    onCloseSubMenu={onCloseSubMenu}
                    root={subMenuNode}
                    isFocused={showSubMenu && openedMenuGroup === groupOption.value}
                  >
                    {showSubMenu && openedMenuGroup === groupOption.value && (
                      <RolePickerSubMenu
                        options={subMenuOptions}
                        selectedOptions={selectedOptions}
                        onSelect={onChangeSubMenu}
                        onClear={onClearSubMenu}
                        showOnLeft={showOnLeftSubMenu}
                      />
                    )}
                  </RoleMenuGroupOption>
                ))
              : roles.map((option) => (
                  <RoleMenuOption
                    data={option}
                    key={option.uid}
                    isSelected={!!(option.uid && !!selectedOptions.find((opt) => opt.uid === option.uid))}
                    disabled={isNotDelegatable(option)}
                    onChange={onChangeSubMenu}
                    hideDescription
                  />
                ))}
          </div>
        )}
      </div>
    );
  }
);

RoleMenuGroupsSection.displayName = 'RoleMenuGroupsSection';
