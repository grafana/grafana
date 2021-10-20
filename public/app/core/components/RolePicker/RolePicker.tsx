import React, { FC, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ClickOutsideWrapper } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { RolePickerMenu } from './RolePickerMenu';
import { RolePickerInput } from './RolePickerInput';

export interface Props {
  /** Primary role selected */
  builtinRole: string;
  // roles: string[];
  getRoles: () => Promise<string[]>;
  getRoleOptions: () => Promise<Array<SelectableValue<string>>>;
  onRolesChange: (newRoles: string[]) => void;
  onBuiltinRoleChange: (newRole: string) => void;
  disabled?: boolean;
}

export const RolePicker = ({
  builtinRole,
  getRoles,
  getRoleOptions,
  onRolesChange,
  onBuiltinRoleChange,
  disabled,
}: Props): JSX.Element => {
  const [isOpen, setOpen] = useState(false);
  const [roleOptions, setRoleOptions] = useState<Array<SelectableValue<string>>>([]);
  const [filteredOptions, setFilteredOptions] = useState<Array<SelectableValue<string>>>([]);
  const [appliedRoles, setAppliedRoles] = useState<{ [key: string]: boolean }>({});
  const [numberOfRoles, setNumberOfRoles] = useState(0);
  const [query, setQuery] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    async function fetchOptions() {
      let options = await getRoleOptions();
      options = options.filter((option) => {
        return (
          !option.label?.startsWith('grafana:') &&
          !option.label?.startsWith('fixed:') &&
          !option.label?.startsWith('managed:')
        );
      });
      setRoleOptions(options);
      setFilteredOptions(options);

      const roles = await getRoles();
      setNumberOfRoles(roles.length);
      const rolesMap = {} as any;
      for (const role of roles) {
        rolesMap[role] = true;
      }
      setAppliedRoles(rolesMap);
    }

    fetchOptions();
  }, [getRoles, getRoleOptions]);

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
    setFilteredOptions(roleOptions);
  }, [roleOptions]);

  const onInputChange = (query?: string) => {
    if (query) {
      setQuery(query);
      setFilteredOptions(
        roleOptions.filter((option) => {
          return option.label?.toLowerCase().includes(query.toLowerCase());
        })
      );
    } else {
      setQuery('');
      setFilteredOptions(roleOptions);
    }
  };

  const onUpdate = (newBuiltInRole: string, newRoles: string[]) => {
    onBuiltinRoleChange(newBuiltInRole);
    onRolesChange(newRoles);
  };

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
          numberOfRoles={Object.keys(appliedRoles).length}
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
