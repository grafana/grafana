import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';

import UserInviteForm from './UserInviteForm';

export function UserInvitePage() {
  const subTitle = (
    <>
      Send invitation or add existing Grafana user to the organization.
      <span className="highlight-word"> {contextSrv.user.orgName}</span>
    </>
  );

  return (
    <Page navId="global-users" pageNav={{ text: 'Invite user' }} subTitle={subTitle}>
      <Page.Contents>
        <UserInviteForm />
      </Page.Contents>
    </Page>
  );
}

export default UserInvitePage;
