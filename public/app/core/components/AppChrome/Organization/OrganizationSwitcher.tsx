import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
import { getUserOrganizations, setUserOrganization } from 'app/features/org/state/actions';
import { useDispatch, useSelector, UserOrg } from 'app/types';

import { OrganizationPicker } from './OrganizationPicker';
import { OrganizationSelect } from './OrganizationSelect';

export function OrganizationSwitcher() {
  const theme = useTheme2();
  const dispatch = useDispatch();
  const orgs = useSelector((state) => state.organization.userOrgs);
  const [isSmallScreen, setIsSmallScreen] = useState(
    window.matchMedia(`(max-width: ${theme.breakpoints.values.sm}px)`).matches
  );
  const onSelectChange = (option: SelectableValue<UserOrg>) => {
    if (option.value) {
      setUserOrganization(option.value.orgId);
      locationService.partial({ orgId: option.value.orgId }, true);
      // TODO how to reload the current page
      window.location.reload();
    }
  };
  useEffect(() => {
    dispatch(getUserOrganizations());
  }, [dispatch]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);
    const onMediaQueryChange = (e: MediaQueryListEvent) => setIsSmallScreen(e.matches);
    mediaQuery.addEventListener('change', onMediaQueryChange);
    return () => mediaQuery.removeEventListener('change', onMediaQueryChange);
  }, [isSmallScreen, theme.breakpoints.values.sm]);

  if (orgs?.length <= 1) {
    return null;
  }

  const Switcher = isSmallScreen ? OrganizationPicker : OrganizationSelect;

  return <Switcher orgs={orgs} onSelectChange={onSelectChange} />;
}
