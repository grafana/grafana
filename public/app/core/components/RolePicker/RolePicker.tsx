import { FormEvent, useCallback, useEffect, useState, useRef } from 'react';

import { OrgRole } from '@grafana/data';
import { ClickOutsideWrapper, Portal, useTheme2 } from '@grafana/ui';
import { Role } from 'app/types/accessControl';

import { RolePickerInput } from './RolePickerInput';
import { RolePickerMenu } from './RolePickerMenu';
import {
  MENU_MAX_HEIGHT,
  ROLE_PICKER_MAX_MENU_WIDTH,
  ROLE_PICKER_MENU_MAX_WIDTH,
  ROLE_PICKER_WIDTH,
} from './constants';

export interface Props {
  basicRole?: OrgRole;
  appliedRoles: Role[];
  roleOptions: Role[];
  isLoading?: boolean;
  disabled?: boolean;
  basicRoleDisabled?: boolean;
  basicRoleDisabledMessage?: string;
  showBasicRole?: boolean;
  onRolesChange: (newRoles: Role[]) => void;
  onBasicRoleChange?: (newRole: OrgRole) => void;
  canUpdateRoles?: boolean;
  /**
   * Set {@link RolePickerMenu}'s button to display either `Apply` (apply=true) or `Update` (apply=false)
   */
  apply?: boolean;
  maxWidth?: string | number;
  width?: string | number;
}

export const RolePicker = ({
  basicRole,
  appliedRoles,
  roleOptions,
  disabled,
  isLoading,
  basicRoleDisabled,
  basicRoleDisabledMessage,
  showBasicRole,
  onRolesChange,
  onBasicRoleChange,
  canUpdateRoles = true,
  apply = false,
  maxWidth = ROLE_PICKER_WIDTH,
  width,
}: Props): JSX.Element | null => {
  const [isOpen, setOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(appliedRoles);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<OrgRole | undefined>(basicRole);
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState({ vertical: 0, horizontal: 0 });
  const [menuLeft, setMenuLeft] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme2();
  const widthPx = typeof width === 'number' ? theme.spacing(width) : width;

  useEffect(() => {
    setSelectedBuiltInRole(basicRole);
    setSelectedRoles(appliedRoles);
  }, [appliedRoles, basicRole, onBasicRoleChange]);

  const setMenuPosition = useCallback(() => {
    const { horizontal, vertical, menuToLeft } = calculateMenuPosition();
    if (horizontal && vertical) {
      setOffset({ horizontal, vertical });
      setMenuLeft(menuToLeft);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setMenuPosition();
  }, [isOpen, selectedRoles, setMenuPosition]);

  const calculateMenuPosition = () => {
    const dimensions = ref?.current?.getBoundingClientRect();
    if (!dimensions) {
      return {};
    }
    const { bottom, top, left, right } = dimensions;

    const spaceBelow = window.innerHeight - bottom;
    const spaceAbove = top;
    const spaceRight = window.innerWidth - right;
    const spaceLeft = left;

    let horizontal = left;
    let vertical = bottom;
    let menuToLeft = false;
    let menuToTop = false;

    // Check vertical space
    if (spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow) {
      vertical = top - MENU_MAX_HEIGHT;
      menuToTop = true;
    }

    // Check horizontal space
    if (spaceRight < ROLE_PICKER_MENU_MAX_WIDTH && spaceLeft < ROLE_PICKER_MENU_MAX_WIDTH) {
      horizontal = right - ROLE_PICKER_MENU_MAX_WIDTH;
      menuToLeft = true;
    } else {
      horizontal = Math.max(0, left + (dimensions.width - ROLE_PICKER_MENU_MAX_WIDTH) / 2);
    }

    // Ensure the menu stays within the viewport
    horizontal = Math.max(0, Math.min(horizontal, window.innerWidth - ROLE_PICKER_MAX_MENU_WIDTH));
    vertical = Math.max(0, Math.min(vertical, window.innerHeight - MENU_MAX_HEIGHT));
    if (menuToTop) {
      // Adjust vertical position to align with the input
      vertical -= 48;
    }
    return { horizontal, vertical, menuToLeft };
  };

  const onOpen = useCallback(
    (event: FormEvent<HTMLElement>) => {
      if (!disabled) {
        event.preventDefault();
        event.stopPropagation();
        setMenuPosition();
        setOpen(true);
      }
    },
    [disabled, setMenuPosition]
  );

  const onClose = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedRoles(appliedRoles);
    setSelectedBuiltInRole(basicRole);
  }, [appliedRoles, basicRole]);

  // Only call onClose if menu is open. Prevent unnecessary calls for multiple pickers on the page.
  const onClickOutside = () => isOpen && onClose();

  const onInputChange = (query?: string) => {
    if (query) {
      setQuery(query);
    } else {
      setQuery('');
    }
  };

  const onSelect = (roles: Role[]) => {
    setSelectedRoles(roles);
  };

  const onBasicRoleSelect = (role: OrgRole) => {
    setSelectedBuiltInRole(role);
  };

  const onUpdate = (newRoles: Role[], newBuiltInRole?: OrgRole) => {
    if (onBasicRoleChange && newBuiltInRole && newBuiltInRole !== basicRole) {
      onBasicRoleChange(newBuiltInRole);
    }
    if (canUpdateRoles) {
      onRolesChange(newRoles);
    }
    setQuery('');
    setOpen(false);
  };

  const getOptions = () => {
    // if roles cannot be updated mark every role as non delegatable
    const options = roleOptions.map((r) => ({ ...r, delegatable: canUpdateRoles && r.delegatable }));

    if (query && query.trim() !== '') {
      // TODO should this filter on `displayName` not (or in addition to) `name`?
      return options.filter((option) => option.name?.toLowerCase().includes(query.toLowerCase()));
    }
    return options;
  };

  return (
    <div
      data-testid="role-picker"
      style={{
        position: 'relative',
        maxWidth: widthPx || maxWidth,
        width: widthPx,
      }}
      ref={ref}
    >
      <ClickOutsideWrapper onClick={onClickOutside} useCapture={false}>
        <RolePickerInput
          basicRole={selectedBuiltInRole}
          appliedRoles={selectedRoles}
          query={query}
          onQueryChange={onInputChange}
          onOpen={onOpen}
          onClose={onClose}
          isFocused={isOpen}
          disabled={disabled}
          showBasicRole={showBasicRole}
          width={widthPx}
          isLoading={isLoading}
        />
        {isOpen && (
          <Portal>
            {/* Since menu rendered in portal and whole component wrapped in ClickOutsideWrapper, */}
            {/* we need to stop event propagation to prevent closing menu */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div onClick={(e) => e.stopPropagation()}>
              <RolePickerMenu
                options={getOptions()}
                isFiltered={query.trim() !== ''}
                basicRole={selectedBuiltInRole}
                appliedRoles={appliedRoles}
                onBasicRoleSelect={onBasicRoleSelect}
                onSelect={onSelect}
                onUpdate={onUpdate}
                showGroups={query.length === 0 || query.trim() === ''}
                basicRoleDisabled={basicRoleDisabled}
                disabledMessage={basicRoleDisabledMessage}
                showBasicRole={showBasicRole}
                updateDisabled={basicRoleDisabled && !canUpdateRoles}
                apply={apply}
                offset={offset}
                menuLeft={menuLeft}
              />
            </div>
          </Portal>
        )}
      </ClickOutsideWrapper>
    </div>
  );
};
