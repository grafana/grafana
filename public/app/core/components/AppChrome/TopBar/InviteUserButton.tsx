import { reportInteraction } from '@grafana/runtime';
import { Box, Button } from '@grafana/ui';
import { config } from 'app/core/config';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { getExternalUserMngLinkUrl } from 'app/features/users/utils';
import { AccessControlAction } from 'app/types';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

export function InviteUserButton() {
  return config.externalUserMngLinkUrl && contextSrv.hasPermission(AccessControlAction.OrgUsersAdd) ? (
    <Box paddingLeft={1} gap={2} alignItems="center" display="flex">
      <Button
        icon="add-user"
        size="sm"
        variant="secondary"
        fill="solid"
        onClick={() => {
          reportInteraction('invite_user_button_clicked', {
            placement: 'top_bar_right',
          });

          const url = getExternalUserMngLinkUrl('invite-user-top-bar');
          window.open(url.toString(), '_blank');
        }}
        tooltip={t('navigation.invite-user.invite-tooltip', 'Invite new member')}
      >
        {t('navigation.invite-user.invite-button', 'Invite')}
      </Button>
      <NavToolbarSeparator />
    </Box>
  ) : null;
}
