import { css } from '@emotion/css';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Badge } from '@grafana/ui';
import { OrgUser } from 'app/types';

import { RolePickerDrawer } from './RolePickerDrawer';

export interface Props {
  disabled?: boolean;
  user: OrgUser;
}

export const RolePickerBadges = ({ disabled, user }: Props) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { badge, badgeDisabled } = useStyles2(getStyles);
  const badgeStyle = disabled ? badgeDisabled : badge;

  const methods = useForm({
    defaultValues: {
      name: user.name,
      role: user.role,
      roles: user.roles,
    },
  });
  const { watch } = methods;

  const drawerControl = () => {
    if (!disabled) {
      setIsDrawerOpen(true);
    }
  };

  return (
    <>
      <div className={badgeStyle} onClick={drawerControl}>
        <Badge color="blue" text={watch('role')} />
        {user.roles && user.roles.length > 0 && <Badge color="blue" text={'+' + user.roles.length} />}
      </div>
      {isDrawerOpen && (
        <FormProvider {...methods}>
          <RolePickerDrawer onClose={() => setIsDrawerOpen(false)} />
        </FormProvider>
      )}
    </>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    badge: css({
      cursor: 'pointer',
      '& > :first-child': {
        marginRight: theme.spacing(1),
      },
      display: 'flex',
    }),
    badgeDisabled: css({
      cursor: 'not-allowed',
      '& > :first-child': {
        marginRight: theme.spacing(1),
      },
      display: 'flex',
    }),
  };
}
