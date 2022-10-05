import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { UserOrgDTO, SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Icon, Select, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getUserOrganizations, setUserOrganization } from 'app/features/org/state/actions';
import { useDispatch, UserOrg, useSelector } from 'app/types';

export function OrganizationSelect() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const orgs = useSelector((state) => state.organization.userOrgs);
  const { orgName: name, orgId, orgRole: role } = contextSrv.user;

  const onSelectChange = (option: SelectableValue<UserOrg>) => {
    setValue(option);
    if (option.value) {
      setUserOrganization(option.value.orgId);
      locationService.partial({ orgId: option.value.orgId }, true);
      // TODO how to reload the current page
      window.location.reload();
    }
  };

  const [value, setValue] = useState<SelectableValue<UserOrgDTO>>(() => ({
    label: name,
    value: { role, orgId, name },
    description: role,
  }));

  useEffect(() => {
    dispatch(getUserOrganizations());
  }, [dispatch]);

  if (orgs?.length <= 1) {
    return null;
  }

  return (
    <Select<UserOrgDTO>
      width={'auto'}
      value={value}
      prefix={<Icon name="building" />}
      className={styles.select}
      options={orgs.map((org) => ({
        label: org.name,
        description: org.role,
        value: org,
      }))}
      onChange={onSelectChange}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  select: css({
    border: 'none',
    [theme.breakpoints.up('sm')]: {
      background: 'none',
    },
  }),
});
