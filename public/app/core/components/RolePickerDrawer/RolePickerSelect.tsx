import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { toOption } from '@grafana/data';
import { MultiSelect } from '@grafana/ui';

import { RolePickerDrawer } from './RolePickerDrawer';

export interface Props {}

export const RolePickerSelect = ({}: Props) => {
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
            value={value?.map(toOption)}
          />
        )}
      />
      {isDrawerOpen && <RolePickerDrawer onClose={toggleDrawer} />}
    </>
  );
};
