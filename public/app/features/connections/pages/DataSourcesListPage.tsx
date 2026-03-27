import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { AdvisorGenerateReportButton } from 'app/features/connections/components/AdvisorGenerateReportButton/AdvisorGenerateReportButton';
import { AdvisorRedirectNotice } from 'app/features/connections/components/AdvisorRedirectNotice/AdvisorRedirectNotice';
import { DataSourceAddButton } from 'app/features/datasources/components/DataSourceAddButton';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';
import { getDataSourcesCount } from 'app/features/datasources/state/selectors';
import { StoreState, useSelector } from 'app/types/store';

export function DataSourcesListPage() {
  const styles = useStyles2(getStyles);
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));

  const actions =
    dataSourcesCount > 0 ? (
      <div className={styles.actions}>
        <AdvisorGenerateReportButton />
        <DataSourceAddButton />
      </div>
    ) : (
      <AdvisorGenerateReportButton />
    );

  return (
    <Page navId={'connections-datasources'} actions={actions}>
      <Page.Contents>
        <AdvisorRedirectNotice />
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  actions: css({
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
});
