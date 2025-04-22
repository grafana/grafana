import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';

import { Trans } from '../../core/internationalization';

import UserInviteForm from './UserInviteForm';

export function UserInvitePage() {
  const subTitle = (
    <Trans i18nKey="org.user-invite-page.sub-title" values={{ orgName: contextSrv.user.orgName }}>
      Send invitation or add existing Grafana user to the organization.
      <span className="highlight-word"> {'{{orgName}}'}</span>
    </Trans>
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
