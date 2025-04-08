import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { Icon, Select, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { UserOrg } from 'app/types';

import { t } from '../../../internationalization';

import { OrganizationBaseProps } from './types';

export function OrganizationSelect({ orgs, onSelectChange }: OrganizationBaseProps) {
  const styles = useStyles2(getStyles);
  const { orgId } = contextSrv.user;

  const options = useMemo(
    () =>
      orgs.map((org) => ({
        label: org.name,
        description: org.role,
        value: org,
      })),
    [orgs]
  );

  const selectedValue = useMemo(() => options.find((option) => option.value.orgId === orgId), [options, orgId]);

  const [value, setValue] = useState<SelectableValue<UserOrg>>(() => selectedValue);
  const onChange = (option: SelectableValue<UserOrg>) => {
    setValue(option);
    onSelectChange(option);
  };

  return (
    <Select<UserOrg>
      aria-label={t('navigation.org-switcher.aria-label', 'Change organization')}
      width={'auto'}
      value={value}
      prefix={<Icon className="prefix-icon" name="building" />}
      className={styles.select}
      options={options}
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
