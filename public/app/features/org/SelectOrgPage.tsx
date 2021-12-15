import React, { FC, useState } from 'react';
import Page from 'app/core/components/Page/Page';
import { getBackendSrv, config } from '@grafana/runtime';
import { UserOrg } from 'app/types';
import { useAsync } from 'react-use';
import { Button, HorizontalGroup } from '@grafana/ui';
import { setUserOrganization } from './state/actions';
import { connect, ConnectedProps } from 'react-redux';

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

const mapDispatchToProps = {
  setUserOrganization,
};

const connector = connect(null, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export const SelectOrgPage: FC<Props> = ({ setUserOrganization }) => {
  const [orgs, setOrgs] = useState<UserOrg[]>();

  const setUserOrg = async (org: UserOrg) => {
    await setUserOrganization(org.orgId);
    window.location.href = config.appSubUrl + '/';
  };

  useAsync(async () => {
    setOrgs(await getUserOrgs());
  }, []);
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <div>
          <p>
            You have been invited to another organization! Please select which organization that you want to use right
            now. You can change this later at any time.
          </p>
          <HorizontalGroup wrap>
            {orgs &&
              orgs.map((org) => (
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

export default connector(SelectOrgPage);
