import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { LinkButton, Stack } from '@grafana/ui';

import { HOME_ROUTE } from '../shared';

export function createBookmarkSavedNotification() {
  const appEvents = getAppEvents();
  appEvents.publish({
    type: AppEvents.alertSuccess.name,
    payload: [
      'Bookmark created',
      <Stack gap={2} direction="row" key="bookmark-notification">
        <div>
          You can view bookmarks under <i>Explore &gt; Metrics</i>
        </div>
        <LinkButton fill="solid" variant="secondary" href={HOME_ROUTE}>
          View bookmarks
        </LinkButton>
      </Stack>,
    ],
  });
}
