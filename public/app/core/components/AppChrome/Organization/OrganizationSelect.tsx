import { css } from '@emotion/css';
import React, { useState } from 'react';

import { SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { Icon, Select, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { UserOrg } from 'app/types';

import { OrganizationBaseProps } from './types';

export function OrganizationSelect({ orgs, onSelectChange }: OrganizationBaseProps) {
  const styles = useStyles2(getStyles);
  const { orgName: name, orgId, orgRole: role } = contextSrv.user;
  const [value, setValue] = useState<SelectableValue<UserOrg>>(() => ({
    label: name,
    value: { role, orgId, name },
    description: role,
  }));
  const onChange = (option: SelectableValue<UserOrg>) => {
    setValue(option);
    onSelectChange(option);
  };

  return (
    <Select<UserOrg>
      aria-label="Change organization"
      width={'auto'}
      value={value}
      prefix={<Icon className="prefix-icon" name="building" />}
      className={styles.select}
      options={orgs.map((org) => ({
        label: org.name,
        description: org.role,
        value: org,
      }))}
      onChange={onChange}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  select: css({
    border: 'none',
    background: 'none',
    color: theme.colors.text.secondary,
    '&:hover': {
      color: theme.colors.text.primary,

      '& .prefix-icon': css({
        color: theme.colors.text.primary,
      }),
    },
  }),
});
