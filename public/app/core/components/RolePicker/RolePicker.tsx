import React, { FormEvent, useCallback, useEffect, useState, useRef } from 'react';

import { ClickOutsideWrapper, HorizontalGroup, Spinner } from '@grafana/ui';
import { Role, OrgRole } from 'app/types';

import { RolePickerInput } from './RolePickerInput';
import { RolePickerMenu } from './RolePickerMenu';
import { MENU_MAX_HEIGHT, ROLE_PICKER_WIDTH } from './constants';

export interface Props {
  basicRole?: OrgRole;
  appliedRoles: Role[];
  roleOptions: Role[];
  isLoading?: boolean;
  disabled?: boolean;
  basicRoleDisabled?: boolean;
  showBasicRole?: boolean;
  onRolesChange: (newRoles: Role[]) => void;
  onBasicRoleChange?: (newRole: OrgRole) => void;
  canUpdateRoles?: boolean;
  /**
   * Set {@link RolePickerMenu}'s button to display either `Apply` (apply=true) or `Update` (apply=false)
   */
  apply?: boolean;
}

export const RolePicker = ({
  basicRole,
  appliedRoles,
  roleOptions,
  disabled,
  isLoading,
  basicRoleDisabled,
  showBasicRole,
  onRolesChange,
  onBasicRoleChange,
  canUpdateRoles = true,
  apply = false,
}: Props): JSX.Element | null => {
  const [isOpen, setOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(appliedRoles);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<OrgRole | undefined>(basicRole);
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState({ vertical: 0, horizontal: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedBuiltInRole(basicRole);
    setSelectedRoles(appliedRoles);
  }, [appliedRoles, basicRole]);

  useEffect(() => {
    const dimensions = ref?.current?.getBoundingClientRect();
    if (!dimensions || !isOpen) {
      return;
    }
    const { bottom, top, left, right } = dimensions;
    const distance = window.innerHeight - bottom;
    const offsetVertical = bottom - top + 10; // Add extra 10px to offset to account for border and outline
    const offsetHorizontal = right - left;
    let horizontal = -offsetHorizontal;
    let vertical = -offsetVertical;

    if (distance < MENU_MAX_HEIGHT + 20) {
      vertical = offsetVertical;
    }

    if (window.innerWidth - right < ROLE_PICKER_WIDTH) {
      horizontal = offsetHorizontal;
    }

    setOffset({ horizontal, vertical });
  }, [isOpen, selectedRoles]);

  const onOpen = useCallback(
    (event: FormEvent<HTMLElement>) => {
      if (!disabled) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
      }
    },
    [setOpen, disabled]
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
      return options.filter((option) => option.name?.toLowerCase().includes(query.toLowerCase()));
    }
    return options;
  };

  if (isLoading) {
    return (
      <HorizontalGroup justify="center">
        <span>Loading...</span>
        <Spinner size={16} />
      </HorizontalGroup>
    );
  }

  return (
    <div data-testid="role-picker" style={{ position: 'relative', width: ROLE_PICKER_WIDTH }} ref={ref}>
      <ClickOutsideWrapper onClick={onClickOutside}>
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
        />
        {isOpen && (
          <RolePickerMenu
            options={getOptions()}
            basicRole={selectedBuiltInRole}
            appliedRoles={appliedRoles}
            onBasicRoleSelect={onBasicRoleSelect}
            onSelect={onSelect}
            onUpdate={onUpdate}
            showGroups={query.length === 0 || query.trim() === ''}
            basicRoleDisabled={basicRoleDisabled}
            showBasicRole={showBasicRole}
            updateDisabled={basicRoleDisabled && !canUpdateRoles}
            apply={apply}
            offset={offset}
          />
        )}
      </ClickOutsideWrapper>
    </div>
  );
};
