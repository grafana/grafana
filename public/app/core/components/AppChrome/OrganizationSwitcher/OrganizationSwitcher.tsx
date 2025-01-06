import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Text, useStyles2, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { contextSrv } from 'app/core/services/context_srv';
import { getUserOrganizations, setUserOrganization } from 'app/features/org/state/actions';
import { useDispatch, useSelector, UserOrg } from 'app/types';

import { Branding } from '../../Branding/Branding';

import { OrganizationPicker } from './OrganizationPicker';
import { OrganizationSelect } from './OrganizationSelect';

export function OrganizationSwitcher() {
  const theme = useTheme2();
  const dispatch = useDispatch();
  const orgs = useSelector((state) => state.organization.userOrgs);
  const styles = useStyles2(getStyles);
  const onSelectChange = (option: SelectableValue<UserOrg>) => {
    if (option.value) {
      setUserOrganization(option.value.orgId);
      locationService.push(`/?orgId=${option.value.orgId}`);
      // TODO how to reload the current page
      window.location.reload();
    }
  };
  useEffect(() => {
    if (
      contextSrv.isSignedIn &&
      !(contextSrv.user.authenticatedBy === 'apikey' || contextSrv.user.authenticatedBy === 'render')
    ) {
      dispatch(getUserOrganizations());
    }
  }, [dispatch]);

  const breakpoint = theme.breakpoints.values.sm;

  const [isSmallScreen, setIsSmallScreen] = useState(
    !config.featureToggles.singleTopNav && !window.matchMedia(`(min-width: ${breakpoint}px)`).matches
  );

  useMediaQueryChange({
    breakpoint,
    onChange: (e) => {
      setIsSmallScreen(!config.featureToggles.singleTopNav && !e.matches);
    },
  });

  if (orgs?.length <= 1) {
    if (config.featureToggles.singleTopNav) {
      return (
        <span className={styles.brandTitle}>
          <Text truncate>{Branding.AppTitle}</Text>
        </span>
      );
    } else {
      return null;
    }
  }

  const Switcher = isSmallScreen ? OrganizationPicker : OrganizationSelect;

  return <Switcher orgs={orgs} onSelectChange={onSelectChange} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  brandTitle: css({
    paddingLeft: theme.spacing(1),
  }),
});
