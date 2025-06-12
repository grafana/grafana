import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { performInviteUserClick } from './utils';

export function InviteUserButton() {
  return (
    <Button
      icon="add-user"
      size="sm"
      variant="secondary"
      fill="solid"
      fullWidth
      onClick={() => {
        performInviteUserClick('bottom_mega_menu', 'invite-user-bottom-mega-menu');
      }}
    >
      {t('navigation.invite-user.invite-new-member-button', 'Invite new member')}
    </Button>
  );
}
