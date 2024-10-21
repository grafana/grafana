import { Controller, useFormContext } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Drawer, Field, RadioButtonGroup, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OrgRole } from 'app/types';

const roleOptions: Array<SelectableValue<string>> = Object.keys(OrgRole).map((key) => {
  return { label: key, value: key };
});

const drawerSubtitle = (
  <Trans i18nKey="role-picker.title.description">
    Assign roles to users to ensure granular control over access to Grafana&lsquo;s features and resources. Find out
    more in our{' '}
    <TextLink
      external
      href="https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/#organization-roles"
    >
      documentation
    </TextLink>
    .
  </Trans>
);

export interface Props {
  onClose: () => void;
}

export const RolePickerDrawer = ({ onClose }: Props) => {
  const methods = useFormContext();
  const { control, getValues, setValue } = methods;
  return (
    <Drawer title={getValues('name')} subtitle={drawerSubtitle} onClose={onClose}>
      <Field label={t('role-picker-drawer.basic-roles.label', 'Basic Roles')}>
        <Controller
          name="role"
          control={control}
          render={({ field: { ref, ...fields } }) => (
            <RadioButtonGroup
              {...fields}
              options={roleOptions}
              onChange={(v) => {
                setValue('role', v);
                setValue('roleCollection', [getValues('role'), ...getValues('roles')]);
              }}
            />
          )}
        />
      </Field>
    </Drawer>
  );
};
