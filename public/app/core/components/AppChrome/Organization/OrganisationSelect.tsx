import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { UserOrgDTO, SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Icon, Select, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getUserOrganizations } from 'app/features/org/state/actions';
import { useDispatch, UserOrg, useSelector } from 'app/types';

import { api } from '../../../../features/profile/api';

export function OrganisationSelect() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const orgs = useSelector((state) => state.organization.userOrgs);
  const { orgName: name, orgId, orgRole: role } = contextSrv.user;

  const [userOrgState, setUserOrg] = useAsyncFn(async (option: SelectableValue<UserOrg>) => {
    if (option.value) {
      await api.setUserOrg(option.value);
      locationService.partial({ orgId: option.value.orgId }, true);
      // locationService.reload();
      window.location.reload();
    }
  }, []);

  const [value, setValue] = useState<SelectableValue<UserOrgDTO>>(() => ({
    label: name,
    value: { role, orgId, name },
    description: role,
  }));

  useEffect(() => {
    dispatch(getUserOrganizations());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!orgs?.length) {
    return null;
  }

  return (
    <Select<UserOrgDTO>
      width={'auto'}
      value={value}
      prefix={<Icon name="building" />}
      className={styles.select}
      options={orgs.map(({ orgId, name, role }) => ({
        label: name,
        description: role,
        value: {
          orgId,
          name,
          role,
        },
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
      background: 'none',
      border: 'none',
    }),
  };
};
