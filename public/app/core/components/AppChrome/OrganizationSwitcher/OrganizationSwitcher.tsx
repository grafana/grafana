import { useEffect } from 'react';

import type { SelectableValue } from '@grafana/data';
import { Text } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getUserOrganizations, setUserOrganization } from 'app/features/org/state/actions';
import { useDispatch, useSelector } from 'app/types/store';
import { type UserOrg } from 'app/types/user';

import { Branding } from '../../Branding/Branding';

import { OrganizationSelect } from './OrganizationSelect';

export function OrganizationSwitcher() {
  const dispatch = useDispatch();
  const orgs = useSelector((state) => state.organization.userOrgs);
  const onSelectChange = async (option: SelectableValue<UserOrg>) => {
    if (!option.value) {
      return;
    }
    try {
      // Await so /api/user/using/:orgId persists the active org before we reload
      await dispatch(setUserOrganization(option.value.orgId));
    } catch {
      // backendSrv shows the error toast; abort so we don't reload into the wrong org
      return;
    }
    // Hard reload so cached state (Redux, RTK Query, scenes) from the previous org is cleared
    window.location.reload();
  };
  useEffect(() => {
    if (
      contextSrv.isSignedIn &&
      !(contextSrv.user.authenticatedBy === 'apikey' || contextSrv.user.authenticatedBy === 'render')
    ) {
      dispatch(getUserOrganizations());
    }
  }, [dispatch]);

  if (orgs?.length <= 1) {
    return <Text truncate>{Branding.AppTitle}</Text>;
  }

  return <OrganizationSelect orgs={orgs} onSelectChange={onSelectChange} />;
}
