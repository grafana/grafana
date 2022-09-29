import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync, useAsyncFn } from 'react-use';

import { UserOrgDTO, SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { Icon, Select, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { api } from '../../../features/profile/api';

export function OrganizationSwitcher() {
  const { orgName: name, orgId, orgRole: role } = contextSrv.user;
  console.log(name);
  const styles = useStyles2(getStyles);
  const loadOrgState = useAsync(api.loadOrgs, []);
  const [userOrgState, setUserOrg] = useAsyncFn(async (org: SelectableValue<UserOrgDTO>) => {
    const userOrg: UserOrgDTO = {
      orgId: org.orgId,
      name: org.name,
      role: org.role,
    };
    await api.setUserOrg(userOrg);

    // TODO reload the page??
  }, []);
  const [value, setValue] = useState<SelectableValue<UserOrgDTO>>(() => ({
    label: name,
    value: orgId,
    description: role,
    role,
    orgId,
    name,
  }));

  const orgs: Array<SelectableValue<UserOrgDTO>> = loadOrgState.value || [{ name, orgId, role }];
  console.log(userOrgState.loading);
  return (
    <Select<UserOrgDTO>
      width={'auto'}
      value={value}
      prefix={<Icon name="building" />}
      className={styles.select}
      options={orgs.map(({ orgId, name, role }) => ({
        label: name,
        description: role,
        value: orgId,
        orgId,
        name,
        role,
      }))}
      disabled={userOrgState.loading}
      onChange={async (v) => {
        setValue(v);
        await setUserOrg(v);
      }}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    select: css({
      margin: theme.spacing(0, 2),
    }),
  };
};
