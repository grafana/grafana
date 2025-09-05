import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';

import UserInviteForm from './UserInviteForm';

export function UserInvitePage() {
  const subTitle = (
    <>
      Отправьте приглашение или добавьте существующего пользователя Grafana в организацию.
      <span className="highlight-word"> {contextSrv.user.orgName}</span>
    </>
  );

  return (
    <Page navId="global-users" pageNav={{ text: 'Пригласить пользователя' }} subTitle={subTitle}>
      <Page.Contents>
        <UserInviteForm />
      </Page.Contents>
    </Page>
  );
}

export default UserInvitePage;
