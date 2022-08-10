import React, { FormEvent, useCallback, useEffect, useState, useRef } from 'react';

import { ClickOutsideWrapper, HorizontalGroup, Spinner } from '@grafana/ui';
import { Role, OrgRole } from 'app/types';

import { RolePickerInput } from './RolePickerInput';
import { RolePickerMenu } from './RolePickerMenu';
import { MENU_MAX_HEIGHT, ROLE_PICKER_WIDTH } from './constants';

export interface Props {
  builtInRole?: OrgRole;
  appliedRoles: Role[];
  roleOptions: Role[];
  builtInRoles?: Record<string, Role[]>;
  isLoading?: boolean;
  disabled?: boolean;
  builtinRolesDisabled?: boolean;
  showBuiltInRole?: boolean;
  onRolesChange: (newRoles: Role[]) => void;
  onBuiltinRoleChange?: (newRole: OrgRole) => void;
  updateDisabled?: boolean;
}

export const RolePicker = ({
  builtInRole,
  appliedRoles,
  roleOptions,
  disabled,
  isLoading,
  builtinRolesDisabled,
  showBuiltInRole,
  onRolesChange,
  onBuiltinRoleChange,
  updateDisabled,
}: Props): JSX.Element | null => {
  const [isOpen, setOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(appliedRoles);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<OrgRole | undefined>(builtInRole);
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState({ vertical: 0, horizontal: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedBuiltInRole(builtInRole);
    setSelectedRoles(appliedRoles);
  }, [appliedRoles, builtInRole]);

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
    setSelectedBuiltInRole(builtInRole);
  }, [appliedRoles, builtInRole]);

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

  const onBuiltInRoleSelect = (role: OrgRole) => {
    setSelectedBuiltInRole(role);
  };

  const onUpdate = (newRoles: Role[], newBuiltInRole?: OrgRole) => {
    if (onBuiltinRoleChange && newBuiltInRole && newBuiltInRole !== builtInRole) {
      onBuiltinRoleChange(newBuiltInRole);
    }
    onRolesChange(newRoles);
    setOpen(false);
    setQuery('');
  };

  const getOptions = () => {
    if (query && query.trim() !== '') {
      return roleOptions.filter((option) => option.name?.toLowerCase().includes(query.toLowerCase()));
    }
    return roleOptions;
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
          builtInRole={selectedBuiltInRole}
          appliedRoles={selectedRoles}
          query={query}
          onQueryChange={onInputChange}
          onOpen={onOpen}
          onClose={onClose}
          isFocused={isOpen}
          disabled={disabled}
          showBuiltInRole={showBuiltInRole}
        />
        {isOpen && (
          <RolePickerMenu
            options={getOptions()}
            builtInRole={selectedBuiltInRole}
            appliedRoles={appliedRoles}
            onBuiltInRoleSelect={onBuiltInRoleSelect}
            onSelect={onSelect}
            onUpdate={onUpdate}
            showGroups={query.length === 0 || query.trim() === ''}
            builtinRolesDisabled={builtinRolesDisabled}
            showBuiltInRole={showBuiltInRole}
            updateDisabled={updateDisabled || false}
            offset={offset}
          />
        )}
      </ClickOutsideWrapper>
    </div>
  );
};
