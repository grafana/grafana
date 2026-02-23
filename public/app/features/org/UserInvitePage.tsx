import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';

import { UsersExternalButton } from '../users/UsersExternalButton';

import UserInviteForm from './UserInviteForm';

export function UserInvitePage() {
  const subTitle = (
    <Trans i18nKey="org.user-invite-page.sub-title" values={{ orgName: contextSrv.user.orgName }}>
      Send invitation or add existing Grafana user to the organization.
      <span className="highlight-word"> {'{{orgName}}'}</span>
    </Trans>
  );

  const onExternalUserMngClick = () => {
    reportInteraction('admin_manage_users_invite_form_action_clicked');
  };

  const actions = <UsersExternalButton onExternalUserMngClick={onExternalUserMngClick} />;

  return (
    <Page
      navId="global-users"
      pageNav={{ text: t('org.user-invite-page.text.invite-user', 'Invite user') }}
      subTitle={subTitle}
      actions={actions}
    >
      <Page.Contents>
        <UserInviteForm />
      </Page.Contents>
    </Page>
  );
}

export default UserInvitePage;
