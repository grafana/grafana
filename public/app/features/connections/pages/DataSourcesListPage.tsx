import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { AdvisorRedirectNotice } from 'app/features/connections/components/AdvisorRedirectNotice/AdvisorRedirectNotice';
import { DataSourceAddButton } from 'app/features/datasources/components/DataSourceAddButton';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';
import { getDataSourcesCount } from 'app/features/datasources/state/selectors';
import { StoreState, useSelector } from 'app/types/store';

export function DataSourcesListPage() {
  const styles = useStyles2(getStyles);
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));

  const actions = dataSourcesCount > 0 ? <DataSourceAddButton /> : undefined;
  return (
    <Page navId={'connections-datasources'} actions={actions}>
      <Page.Contents className={styles.pageContents}>
        <AdvisorRedirectNotice />
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pageContents: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
    minHeight: 0,
  }),
});
