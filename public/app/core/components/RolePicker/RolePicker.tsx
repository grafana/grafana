import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { ClickOutsideWrapper } from '@grafana/ui';
import { RolePickerMenu } from './RolePickerMenu';
import { RolePickerInput } from './RolePickerInput';
import { Role, OrgRole } from 'app/types';

export interface Props {
  builtInRole: OrgRole;
  getRoles: () => Promise<Role[]>;
  getRoleOptions: () => Promise<Role[]>;
  getBuiltinRoles: () => Promise<{ [key: string]: Role[] }>;
  onRolesChange: (newRoles: string[]) => void;
  onBuiltinRoleChange: (newRole: OrgRole) => void;
  disabled?: boolean;
}

export const RolePicker = ({
  builtInRole,
  getRoles,
  getRoleOptions,
  getBuiltinRoles,
  onRolesChange,
  onBuiltinRoleChange,
  disabled,
}: Props): JSX.Element | null => {
  const [isOpen, setOpen] = useState(false);
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [appliedRoles, setAppliedRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<OrgRole>(builtInRole);
  const [builtInRoles, setBuiltinRoles] = useState<{ [key: string]: Role[] }>({});
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOptions() {
      try {
        let options = await getRoleOptions();
        setRoleOptions(options.filter((option) => !option.name?.startsWith('managed:')));

        const builtInRoles = await getBuiltinRoles();
        setBuiltinRoles(builtInRoles);

        const builtInUids = builtInRoles[builtInRole].map((r) => r.uid);
        const roles = await getRoles();
        const applied = roles.filter((role) => !builtInUids.includes(role.uid));
        setAppliedRoles(applied);
        setSelectedRoles(applied);
      } catch (e) {
        // TODO handle error
        console.error('Error loading options');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOptions();
  }, [getRoles, getRoleOptions, getBuiltinRoles, builtInRole]);

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

  const onUpdate = (newBuiltInRole: OrgRole, newRoles: string[]) => {
    onBuiltinRoleChange(newBuiltInRole);
    onRolesChange(newRoles);
  };

  const getOptions = () => {
    if (query) {
      return roleOptions.filter((option) => option.name?.toLowerCase().includes(query.toLowerCase()));
    }
    return roleOptions;
  };

  if (isLoading) {
    return null;
  }

  return (
    <div data-testid="role-picker" style={{ position: 'relative' }}>
      <ClickOutsideWrapper onClick={onClose}>
        <RolePickerInput
          builtInRole={selectedBuiltInRole}
          builtInRoles={builtInRoles[selectedBuiltInRole]}
          appliedRoles={selectedRoles}
          query={query}
          onQueryChange={onInputChange}
          onOpen={onOpen}
          onClose={onClose}
          isFocused={isOpen}
          disabled={disabled}
        />
        {isOpen && (
          <RolePickerMenu
            options={getOptions()}
            builtInRole={selectedBuiltInRole}
            builtInRoles={builtInRoles}
            appliedRoles={appliedRoles}
            onBuiltInRoleSelect={onBuiltInRoleSelect}
            onSelect={onSelect}
            onUpdate={onUpdate}
            showGroups={query.length === 0}
          />
        )}
      </ClickOutsideWrapper>
    </div>
  );
};
