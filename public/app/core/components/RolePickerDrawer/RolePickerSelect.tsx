import { Controller, useFormContext } from 'react-hook-form';

import { toOption } from '@grafana/data';
import { MultiSelect } from '@grafana/ui';

export interface Props {}

// TODO: Wire up RolePickerDrawer for service account role selection
// The drawer now requires user-specific props (userId, basicRole, etc.)
// This component needs to be updated for the service account context
export const RolePickerSelect = ({}: Props) => {
  const { control } = useFormContext();

  return (
    <Controller
      name="role-collection"
      control={control}
      render={({ field: { ref, value, ...field } }) => (
        <MultiSelect
          {...field}
          onChange={() => {
            // TODO: open drawer for role selection
          }}
          value={value?.map(toOption)}
        />
      )}
    />
  );
};
