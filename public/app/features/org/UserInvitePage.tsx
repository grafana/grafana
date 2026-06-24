import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';

import { UsersExternalButton } from '../users/UsersExternalButton';

import UserInviteForm from './UserInviteForm';

export function UserInvitePage() {
  const subTitle = (
<<<<<<< HEAD
    <>
      Отправьте приглашение или добавьте существующего пользователя Grafana в организацию.
      <span className="highlight-word"> {contextSrv.user.orgName}</span>
    </>
=======
    <Trans i18nKey="org.user-invite-page.sub-title" values={{ orgName: contextSrv.user.orgName }}>
      Send invitation or add existing Grafana user to the organization.
      <span className="highlight-word"> {'{{orgName}}'}</span>
    </Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
  );

  const onExternalUserMngClick = () => {
    reportInteraction('admin_manage_users_invite_form_action_clicked');
  };

  const actions = <UsersExternalButton onExternalUserMngClick={onExternalUserMngClick} />;

  return (
<<<<<<< HEAD
    <Page navId="global-users" pageNav={{ text: 'Пригласить пользователя' }} subTitle={subTitle}>
=======
    <Page
      navId="global-users"
      pageNav={{ text: t('org.user-invite-page.text.invite-user', 'Invite user') }}
      subTitle={subTitle}
      actions={actions}
    >
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      <Page.Contents>
        <UserInviteForm />
      </Page.Contents>
    </Page>
  );
}

export default UserInvitePage;
