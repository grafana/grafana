import React, { FC, FormEvent, useCallback, useEffect, useState } from 'react';
import { ClickOutsideWrapper } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Role } from 'app/types';
import { RolePickerInput, RolePickerMenu } from './RolePickerMenu';

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

export interface Props {
  /** Primary role selected */
  role: string;
  onChange: (newRole: string) => void;
  onBuiltinRoleChange: (newRole: string) => void;
}

export const RolePicker: FC<Props> = ({ role, onChange, onBuiltinRoleChange }) => {
  const [isOpen, setOpen] = useState(false);
  const [roleOptions, setRoleOptions] = useState([]);

  useEffect(() => {
    async function fetchOptions() {
      const options = await getRolesOptions();
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
    <div data-testid="date-time-picker" style={{ position: 'relative' }}>
      <RolePickerInput role={role} onChange={onChange} onOpen={onOpen} />
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

const getRolesOptions = async (query?: string) => {
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
