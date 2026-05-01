import { useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { Text } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getUserOrganizations, setUserOrganization } from 'app/features/org/state/actions';
import { useDispatch, useSelector } from 'app/types/store';
import { UserOrg } from 'app/types/user';

import { Branding } from '../../Branding/Branding';

import { OrganizationSelect } from './OrganizationSelect';

export function OrganizationSwitcher() {
  const dispatch = useDispatch();
  const orgs = useSelector((state) => state.organization.userOrgs);
  const onSelectChange = async (option: SelectableValue<UserOrg>) => {
    if (!option.value) {
      return;
    }
    // dispatch() actually runs the thunk. Calling setUserOrganization() without
    // dispatching just builds the action and discards it. Await it so
    // /api/user/using/:orgId completes before navigation and preferred-org persists.
    await dispatch(setUserOrganization(option.value.orgId));
    window.location.assign(`/?orgId=${option.value.orgId}`);
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
