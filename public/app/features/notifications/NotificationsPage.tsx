import { Trans } from '@grafana/i18n';
import { useFlagGrafanaDashboardCommentNotifications } from '@grafana/runtime/internal';
import { Page } from 'app/core/components/Page/Page';

import { InboxNotifications } from './InboxNotifications';
import { LocalAppNotifications } from './LocalAppNotifications';

export const NotificationsPage = () => {
  const inboxEnabled = useFlagGrafanaDashboardCommentNotifications();
  return (
    <Page navId="profile/notifications">
      <Page.Contents>
        {inboxEnabled && <InboxNotifications />}
        <section>
          <h3>
            <Trans i18nKey="notifications.local.title">Browser warnings &amp; errors</Trans>
          </h3>
          <LocalAppNotifications />
        </section>
      </Page.Contents>
    </Page>
  );
};

export default NotificationsPage;
