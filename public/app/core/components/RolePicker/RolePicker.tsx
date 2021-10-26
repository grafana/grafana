import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ClickOutsideWrapper } from '@grafana/ui';
import { RolePickerMenu } from './RolePickerMenu';
import { RolePickerInput } from './RolePickerInput';
import { Role } from 'app/types';

export interface Props {
  builtinRole: string;
  getRoles: () => Promise<string[]>;
  getRoleOptions: () => Promise<Role[]>;
  getBuiltinRoles: () => Promise<{ [key: string]: Role[] }>;
  onRolesChange: (newRoles: string[]) => void;
  onBuiltinRoleChange: (newRole: string) => void;
  disabled?: boolean;
}

export const RolePicker = ({
  builtinRole,
  getRoles,
  getRoleOptions,
  getBuiltinRoles,
  onRolesChange,
  onBuiltinRoleChange,
  disabled,
}: Props): JSX.Element => {
  const [isOpen, setOpen] = useState(false);
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [appliedRoles, setAppliedRoles] = useState<string[]>([]);
  const [builtinRoles, setBuiltinRoles] = useState<{ [key: string]: Role[] }>({});
  const [query, setQuery] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    async function fetchOptions() {
      let options = await getRoleOptions();
      setRoleOptions(options.filter((option) => !option.name?.startsWith('managed:')));

      const roles = await getRoles();
      setAppliedRoles(roles);

      const builtinRoles = await getBuiltinRoles();
      setBuiltinRoles(builtinRoles);
    }

    fetchOptions();
  }, [getRoles, getRoleOptions, getBuiltinRoles, builtinRole]);

  const onOpen = useCallback(
    (event: FormEvent<HTMLElement>) => {
      if (!disabled) {
        event.preventDefault();
        setOpen(true);
      }
    },
    [setOpen, disabled]
  );

  const onClose = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const onInputChange = (query?: string) => {
    if (query) {
      setQuery(query);
    } else {
      setQuery('');
    }
  };

  const onUpdate = (newBuiltInRole: string, newRoles: string[]) => {
    onBuiltinRoleChange(newBuiltInRole);
    onRolesChange(newRoles);
  };

  const appliedRolesCount = roleOptions.filter((option) => {
    return option.uid && appliedRoles.includes(option.uid) && !option.name?.startsWith('fixed:');
  }).length;

  return (
    <div data-testid="role-picker" style={{ position: 'relative' }}>
      <ClickOutsideWrapper onClick={onClose}>
        <RolePickerInput
          role={builtinRole}
          query={query}
          onQueryChange={onInputChange}
          onOpen={onOpen}
          onClose={onClose}
          isFocused={isOpen}
          numberOfRoles={appliedRolesCount}
          ref={inputRef}
          disabled={disabled}
        />
        {isOpen && (
          <RolePickerMenu
            options={
              query
                ? roleOptions.filter((option) => option.name?.toLowerCase().includes(query.toLowerCase()))
                : roleOptions
            }
            builtInRole={builtinRole}
            builtInRoles={builtinRoles}
            appliedRoles={appliedRoles}
            onUpdate={onUpdate}
            onClose={onClose}
          />
        )}
      </ClickOutsideWrapper>
    </div>
  );
};
