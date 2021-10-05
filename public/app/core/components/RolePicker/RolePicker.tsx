import React, { FC, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ClickOutsideWrapper } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Role } from 'app/types';
import { RolePickerMenu } from './RolePickerMenu';
import { RolePickerInput } from './RolePickerInput';

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

export interface Props {
  /** Primary role selected */
  role: string;
  onChange: (newRole: string) => void;
  onBuiltinRoleChange: (newRole: string) => void;
}

export const RolePicker: FC<Props> = ({ role, onChange, onBuiltinRoleChange }) => {
  const [isOpen, setOpen] = useState(false);
  const [roleOptions, setRoleOptions] = useState([] as Array<SelectableValue<string>>);

  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    async function fetchOptions() {
      let options = await getRolesOptions();
      options = options.filter((option) => {
        return (
          !option.label?.startsWith('grafana:') &&
          !option.label?.startsWith('fixed:') &&
          !option.label?.startsWith('managed:')
        );
      });
      setRoleOptions(options);
    }
    fetchOptions();
  }, []);

  const onApply = useCallback(
    (role: string) => {
      setOpen(false);
      onChange(role);
    },
    [onChange]
  );

  const onOpen = useCallback(
    (event: FormEvent<HTMLElement>) => {
      event.preventDefault();
      setOpen(true);
    },
    [setOpen]
  );

  return (
    <div data-testid="role-picker" style={{ position: 'relative' }}>
      <RolePickerInput role={role} onChange={onChange} onOpen={onOpen} ref={inputRef} />
      {isOpen && (
        <ClickOutsideWrapper onClick={() => setOpen(false)}>
          <RolePickerMenu
            onBuiltinRoleChange={onBuiltinRoleChange}
            onChange={onApply}
            onClose={() => setOpen(false)}
            options={roleOptions}
            builtInRole={role}
          />
          <div className="" onClick={stopPropagation} />
        </ClickOutsideWrapper>
      )}
    </div>
  );
};

const getRolesOptions = async (query?: string): Promise<Array<SelectableValue<string>>> => {
  const roles = await getBackendSrv().get('/api/access-control/roles');
  if (!roles || !roles.length) {
    return [];
  }
  return roles.map(
    (role: Role): SelectableValue => ({
      value: role.uid,
      label: role.name,
      description: role.description,
    })
  );
};
