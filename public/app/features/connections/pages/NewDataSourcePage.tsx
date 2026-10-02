import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { NewDataSource } from 'app/features/datasources/components/NewDataSource';

export function NewDataSourcePage() {
  // CUJ-only signals: page_view starts datasource_configure when the user lands
  // here directly; page_left is emitted on every unmount. The journey wiring
  // treats page_left as abandoned only when no plugin was selected yet — picking
  // a type also unmounts this page while navigating to the config screen.
  useEffect(() => {
    reportInteraction('connections_new_datasource_page_view', {}, { silent: true });
    return () => {
      reportInteraction('connections_new_datasource_page_left', {}, { silent: true });
    };
  }, []);

  return (
    <Page
      navId={'connections-datasources'}
      pageNav={{
        text: t('connections.new-data-source-page.text.add-data-source', 'Add data source'),
        subTitle: t('connections.new-data-source-page.subTitle.choose-a-data-source-type', 'Choose a data source type'),
        active: true,
      }}
    >
      <Page.Contents>
        <NewDataSource />
      </Page.Contents>
    </Page>
  );
}
