import React from 'react';

import { locationService } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';

import { createSuccessNotification } from '../../../core/copy/appNotification';
import { HOME_ROUTE } from '../shared';

export function createBookmarkSavedNotification() {
  const notification = createSuccessNotification('History successfully saved');

  const onClick = () => {
    locationService.push(HOME_ROUTE);
  };

  notification.component = (
    <Stack gap={2} direction={'row'}>
      <div>
        You can view bookmarks under <i>Explore &gt; Metrics</i>
      </div>
      <Button fill={'outline'} variant={'success'} onClick={onClick}>
        View bookmarks
      </Button>
    </Stack>
  );
  return notification;
}
