import { LinkButton, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { createSuccessNotification } from '../../../core/copy/appNotification';
import { HOME_ROUTE } from '../shared';

export function createBookmarkSavedNotification() {
  const notification = createSuccessNotification('Bookmark created');

  notification.component = (
    <Stack gap={2} direction={'row'}>
      <div>
        You can view bookmarks under <i>Explore &gt; Metrics</i>
      </div>
      <LinkButton fill={'solid'} variant={'secondary'} href={HOME_ROUTE}>
        <Trans i18nKey="trails.create-bookmark-saved-notification.view-bookmarks">View bookmarks</Trans>
      </LinkButton>
    </Stack>
  );
  return notification;
}
