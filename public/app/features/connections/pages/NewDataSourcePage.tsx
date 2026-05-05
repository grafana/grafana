import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { NewDataSource } from 'app/features/datasources/components/NewDataSource';

export function NewDataSourcePage() {
  // CUJ-only signals: page_view starts datasource_configure when the user lands
  // here directly; page_left ends it as abandoned if they navigate away without
  // picking a plugin. Mirrors the EditDataSource page-leave handler so a journey
  // started here always has a terminating event.
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
