import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useEffectOnce } from 'react-use';

import { config } from '@grafana/runtime';
import { Button, HorizontalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { StoreState, UserOrg } from 'app/types';

import { getUserOrganizations, setUserOrganization } from './state/actions';

const navModel = {
  main: {
    icon: 'grafana' as const,
    subTitle: 'Preferences',
    text: 'Select active organization',
  },
  node: {
    text: 'Select active organization',
  },
};

const mapStateToProps = (state: StoreState) => {
  return {
    userOrgs: state.organization.userOrgs,
  };
};

const mapDispatchToProps = {
  setUserOrganization,
  getUserOrganizations,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export const SelectOrgPage = ({ setUserOrganization, getUserOrganizations, userOrgs }: Props) => {
  const setUserOrg = async (org: UserOrg) => {
    await setUserOrganization(org.orgId);
    window.location.href = config.appSubUrl + '/';
  };

  useEffectOnce(() => {
    getUserOrganizations();
  });

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <div>
          <p>
            You have been invited to another organization! Please select which organization that you want to use right
            now. You can change this later at any time.
          </p>
          <HorizontalGroup wrap>
            {userOrgs &&
              userOrgs.map((org) => (
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
