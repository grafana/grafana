import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ClickOutsideWrapper } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { RolePickerMenu } from './RolePickerMenu';
import { RolePickerInput } from './RolePickerInput';
import { Role } from 'app/types';

export interface Props {
  builtinRole: string;
  getRoles: () => Promise<string[]>;
  getRoleOptions: () => Promise<Array<SelectableValue<string>>>;
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
  const [roleOptions, setRoleOptions] = useState<Array<SelectableValue<string>>>([]);
  const [appliedRoles, setAppliedRoles] = useState<{ [key: string]: boolean }>({});
  const [query, setQuery] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    async function fetchOptions() {
      let options = await getRoleOptions();
      options = options.filter((option) => {
        return !option.label?.startsWith('managed:');
      });
      setRoleOptions(options);

      const roles = await getRoles();
      const rolesMap = {} as any;
      for (const role of roles) {
        rolesMap[role] = true;
      }

      const builtinRoles = await getBuiltinRoles();
      const selectedBuiltinRole = builtinRoles[builtinRole];
      for (const fixedRole of selectedBuiltinRole) {
        rolesMap[fixedRole.uid] = true;
      }
      setAppliedRoles(rolesMap);
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
    return option.value && appliedRoles.hasOwnProperty(option.value) && !option.label?.startsWith('fixed:');
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
                ? roleOptions.filter((option) => option.label?.toLowerCase().includes(query.toLowerCase()))
                : roleOptions
            }
            builtInRole={builtinRole}
            appliedRoles={appliedRoles}
            onUpdate={onUpdate}
            onClose={onClose}
          />
        )}
      </ClickOutsideWrapper>
    </div>
  );
};
