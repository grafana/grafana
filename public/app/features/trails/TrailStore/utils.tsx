import React from 'react';

import { LinkButton, Stack } from '@grafana/ui';

import { createSuccessNotification } from '../../../core/copy/appNotification';
import { HOME_ROUTE } from '../shared';

export function createBookmarkSavedNotification() {
  const notification = createSuccessNotification('Exploration successfully saved');

  notification.component = (
    <Stack gap={2} direction={'row'}>
      <div>
        You can view bookmarks under <i>Explore &gt; Metrics</i>
      </div>
      <LinkButton fill={'text'} variant={'primary'} href={HOME_ROUTE}>
        View bookmarks
      </LinkButton>
    </Stack>
  );
  return notification;
}
