import { css } from '@emotion/css';
import { useEffect } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Text, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getUserOrganizations, setUserOrganization } from 'app/features/org/state/actions';
import { useDispatch, useSelector, UserOrg } from 'app/types';

import { Branding } from '../../Branding/Branding';

import { OrganizationSelect } from './OrganizationSelect';

export function OrganizationSwitcher() {
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

  if (orgs?.length <= 1) {
    return (
      <span className={styles.brandTitle}>
        <Text truncate>{Branding.AppTitle}</Text>
      </span>
    );
  }

  return <OrganizationSelect orgs={orgs} onSelectChange={onSelectChange} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  brandTitle: css({
    paddingLeft: theme.spacing(1),
  }),
});
