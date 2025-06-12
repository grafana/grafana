import { t } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';
import { NewDataSource } from 'app/features/datasources/components/NewDataSource';

export function NewDataSourcePage() {
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
