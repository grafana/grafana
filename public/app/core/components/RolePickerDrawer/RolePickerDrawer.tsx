import { Controller, useFormContext } from 'react-hook-form';

import { toOption } from '@grafana/data';
import { Drawer, Field, RadioButtonGroup, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OrgRole } from 'app/types';

const roleOptions = Object.keys(OrgRole).map(toOption);

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
  const [name, roles] = getValues(['name', 'roles']);
  return (
    <Drawer title={name} subtitle={drawerSubtitle} onClose={onClose}>
      <Field label={t('role-picker-drawer.basic-roles.label', 'Basic Roles')}>
        <Controller
          name="role"
          control={control}
          render={({ field: { onChange, ref, ...fields } }) => (
            <RadioButtonGroup
              {...fields}
              options={roleOptions}
              onChange={(v) => {
                setValue('roleCollection', [v, ...roles]);
                onChange(v);
              }}
            />
          )}
        />
      </Field>
    </Drawer>
  );
};
