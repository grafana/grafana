import React, { useEffect, useState } from 'react';

import { VerticalGroup } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
import { AccessControlAction, useDispatch, useSelector } from 'app/types';
import { contextSrv } from 'app/core/core';
import { updateConfigurationSubtitle } from 'app/core/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import OrgProfile from './OrgProfile';
import { OrgDetailsDTO } from './types';

export default function OrgDetailsPage() {
  const dispatch = useDispatch();
  const [orgName, setOrgName] = useState<string | null>(null);
  useEffect(() => {
    getBackendSrv()
      .get('/api/org')
      .then((curOrg: OrgDetailsDTO) => setOrgName(curOrg.name));
  }, []);

  const onUpdateOrganization = async (orgName: string) => {
    await getBackendSrv().put('/api/org', { name: orgName });

    dispatch(updateConfigurationSubtitle(orgName));
    setOrgName(orgName);
  };

  const navModel = useSelector((state) => getNavModel(state.navIndex, 'org-settings'));
  const canReadOrg = contextSrv.hasPermission(AccessControlAction.OrgsRead);
  const canReadPreferences = contextSrv.hasPermission(AccessControlAction.OrgsPreferencesRead);
  const canWritePreferences = contextSrv.hasPermission(AccessControlAction.OrgsPreferencesWrite);

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={orgName === null}>
        {orgName !== null && (
          <VerticalGroup spacing="lg">
            {canReadOrg && <OrgProfile onSubmit={onUpdateOrganization} orgName={orgName} />}
            {canReadPreferences && <SharedPreferences resourceUri="org" disabled={!canWritePreferences} />}
          </VerticalGroup>
        )}
      </Page.Contents>
    </Page>
  );
}
