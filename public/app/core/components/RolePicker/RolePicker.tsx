import React, { FC, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ClickOutsideWrapper } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { RolePickerMenu } from './RolePickerMenu';
import { RolePickerInput } from './RolePickerInput';

// const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

export interface Props {
  /** Primary role selected */
  builtinRole: string;
  // roles: string[];
  getRoles: () => Promise<string[]>;
  getRoleOptions: () => Promise<Array<SelectableValue<string>>>;
  onRolesChange: (newRoles: string[]) => void;
  onBuiltinRoleChange: (newRole: string) => void;
}

export const RolePicker: FC<Props> = ({
  builtinRole,
  getRoles,
  getRoleOptions,
  onRolesChange,
  onBuiltinRoleChange,
}) => {
  const [isOpen, setOpen] = useState(false);
  const [roleOptions, setRoleOptions] = useState([] as Array<SelectableValue<string>>);
  const [filteredOptions, setFilteredOptions] = useState([] as Array<SelectableValue<string>>);
  const [appliedRoles, setAppliedRoles] = useState({} as { [key: string]: boolean });
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
      event.preventDefault();
      setOpen(true);
    },
    [setOpen]
  );

  const onClose = useCallback(() => {
    setOpen(false);
    setQuery('');
    setFilteredOptions(roleOptions);
  }, [roleOptions]);

  // const onClear = useCallback(() => {
  //   setQuery('');
  //   setFilteredOptions(roleOptions);
  // }, [roleOptions]);

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

  const onBuiltinRoleChangeInternal = (newRole: string) => {
    console.log(newRole);
    onBuiltinRoleChange(newRole);
  };

  const onCustomRoleChangeInternal = (newRoles: string[]) => {
    console.log(newRoles);
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
          ref={inputRef}
        />
        {isOpen && (
          <RolePickerMenu
            onBuiltinRoleChange={onBuiltinRoleChangeInternal}
            onCustomRolesChange={onCustomRoleChangeInternal}
            onClose={onClose}
            // onClear={onClear}
            options={filteredOptions}
            builtInRole={builtinRole}
            appliedRoles={appliedRoles}
          />
        )}
      </ClickOutsideWrapper>
    </div>
  );
};
