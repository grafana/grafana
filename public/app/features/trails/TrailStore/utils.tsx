import { LinkButton, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { createSuccessNotification } from '../../../core/copy/appNotification';
import { HOME_ROUTE } from '../shared';

export function createBookmarkSavedNotification() {
  const notification = createSuccessNotification(t('bmc.notiifcations.success.bookmark-created', 'Bookmark created'));

  notification.component = (
    <Stack gap={2} direction={'row'}>
      <div>
        You can view bookmarks under <i>Explore &gt; Metrics</i>
      </div>
      <LinkButton fill={'solid'} variant={'secondary'} href={HOME_ROUTE}>
        View bookmarks
      </LinkButton>
    </Stack>
  );
  return notification;
}
