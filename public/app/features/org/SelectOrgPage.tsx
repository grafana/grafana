import React, { FC, useState } from 'react';
import Page from 'app/core/components/Page/Page';
import { getBackendSrv, config } from '@grafana/runtime';
import { UserOrg } from 'app/types';
import { useAsync } from 'react-use';
import { Button, HorizontalGroup } from '@grafana/ui';

const navModel = {
  main: {
    icon: 'grafana',
    subTitle: 'Preferences',
    text: 'Select active organization',
  },
  node: {
    text: 'Select active organization',
  },
};

const getUserOrgs = async () => {
  return await getBackendSrv().get('/api/user/orgs');
};
const setUserOrg = async (org: UserOrg) => {
  return await getBackendSrv()
    .post('/api/user/using/' + org.orgId)
    .then(() => {
      window.location.href = config.appSubUrl + '/';
    });
};

export const SelectOrgPage: FC = () => {
  const [orgs, setOrgs] = useState<UserOrg[]>();

  useAsync(async () => {
    setOrgs(await getUserOrgs());
  }, []);
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <div>
          <p>
            You have been added to another Organization due to an open invitation! Please select which organization you
            want to use right now (you can change this later at any time).
          </p>
          <HorizontalGroup wrap>
            {orgs &&
              orgs.map(org => (
                <Button key={org.orgId} icon="signin" onClick={() => setUserOrg(org)}>
                  {org.name}
                </Button>
              ))}
          </HorizontalGroup>
        </div>
      </Page.Contents>
    </Page>
  );
};

export default SelectOrgPage;
