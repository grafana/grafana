import { useEffect } from 'react';

import type { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Box } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getUserOrganizations, setUserOrganization } from 'app/features/org/state/actions';
import { useDispatch, useSelector } from 'app/types/store';
import { type UserOrg } from 'app/types/user';

import { OrganizationSelect } from './OrganizationSelect';

export function OrganizationSwitcher({ children, undocked }: { children?: React.ReactNode; undocked?: boolean }) {
  const dispatch = useDispatch();
  const orgs = useSelector((state) => state.organization.userOrgs);
  const onSelectChange = async (option: SelectableValue<UserOrg>) => {
    if (!option.value) {
      return;
    }
    try {
      // Await so /api/user/using/:orgId completes before navigation
      await dispatch(setUserOrganization(option.value.orgId));
    } catch {
      // backendSrv shows the error toast; abort so we don't reload into the wrong org
      return;
    }
    // Plain reload to root: the POST above persisted the switch server-side, so re-bootstrap lands in
    // the new org without the ?orgId redirect path, which breaks under gateway/JWT auth
    window.location.assign(`${config.appSubUrl}/`);
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
    return children;
  }

  const switcher = <OrganizationSelect orgs={orgs} onSelectChange={onSelectChange} />;

  if (undocked) {
    return (
      <Box paddingX={1} paddingTop={0.5} paddingBottom={1} display="flex" alignItems="center" gap={1}>
        {switcher}
      </Box>
    );
  }

  return switcher;
}
