import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { MultiSelect } from '@grafana/ui';

import { RolePickerDrawer } from './RolePickerDrawer';

export interface Props {}

export const RolePickerSelect = ({}: Props): JSX.Element => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { control } = useFormContext();

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  return (
    <>
      <Controller
        name="role-collection"
        control={control}
        render={({ field: { ref, value, ...field } }) => (
          <MultiSelect
            {...field}
            onOpenMenu={toggleDrawer}
            onChange={() => {
              // TODO cannnot remove basic roles
              // TODO open drawer instead
            }}
            value={value.map((role: string) => ({ label: role, value: role }))}
          />
        )}
      />
      {isDrawerOpen && <RolePickerDrawer onClose={toggleDrawer} />}
    </>
  );
};
