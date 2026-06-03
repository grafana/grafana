import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { EmptyState, LinkButton, Pagination, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { usePagination } from 'app/features/alerting/unified/hooks/usePagination';
import { DataSourcesListCard } from 'app/features/datasources/components/DataSourcesListCard';
import { useLoadDataSources } from 'app/features/datasources/state/hooks';
import { getDataSources } from 'app/features/datasources/state/selectors';
import { AccessControlAction } from 'app/types/accessControl';
import { useSelector } from 'app/types/store';

import { ROUTES } from '../constants';
import { AdvisorCheckProvider, useDatasourceFailureByUID } from '../hooks/useDatasourceAdvisorChecks';

const INSTANCES_PER_PAGE = 25;

function DataSourcesByTypePageContents() {
  const styles = useStyles2(getStyles);
  const { type = '' } = useParams<{ type: string }>();
  const decodedType = decodeURIComponent(type);

  const { isLoading } = useLoadDataSources();
  const allDataSources = useSelector((state) => getDataSources(state.dataSources));
  const { datasourceFailureByUID } = useDatasourceFailureByUID();

  const hasWriteRights = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
  const hasExploreRights = contextSrv.hasAccessToExplore();

  const dataSources = useMemo(
    () => allDataSources.filter((ds) => ds.type === decodedType),
    [allDataSources, decodedType]
  );

  const { page, onPageChange, numberOfPages, pageItems } = usePagination(dataSources, 1, INSTANCES_PER_PAGE);

  if (!isLoading && dataSources.length === 0) {
    return (
      <EmptyState
        variant="not-found"
        message={t('connections.datasources-by-type.empty', 'No data sources of this type found')}
      >
        <TextLink href="/connections/datasources">
          <Trans i18nKey="connections.datasources-by-type.back-to-list">Back to all data sources</Trans>
        </TextLink>
      </EmptyState>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <ul className={styles.list} aria-label={t('connections.datasources-by-type.list-label', 'Data sources')}>
        {pageItems.map((dataSource) => (
          <li key={dataSource.uid}>
            <DataSourcesListCard
              dataSource={dataSource}
              hasWriteRights={hasWriteRights}
              hasExploreRights={hasExploreRights}
              failure={datasourceFailureByUID.get(dataSource.uid)}
            />
          </li>
        ))}
      </ul>
      <Pagination currentPage={page} numberOfPages={numberOfPages} onNavigate={onPageChange} hideWhenSinglePage />
    </Stack>
  );
}

export function DataSourcesByTypePage() {
  const { type = '' } = useParams<{ type: string }>();
  const decodedType = decodeURIComponent(type);
  const allDataSources = useSelector((state) => getDataSources(state.dataSources));
  const typeName = allDataSources.find((ds) => ds.type === decodedType)?.typeName || decodedType;

  const actions = (
    <LinkButton variant="secondary" icon="arrow-left" href={ROUTES.DataSources}>
      <Trans i18nKey="connections.datasources-by-type.back">Back</Trans>
    </LinkButton>
  );

  return (
    <AdvisorCheckProvider>
      <Page navId={'connections-datasources'} pageNav={{ text: typeName }} actions={actions}>
        <Page.Contents>
          <DataSourcesByTypePageContents />
        </Page.Contents>
      </Page>
    </AdvisorCheckProvider>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyle: 'none',
    display: 'grid',
    gap: theme.spacing(1),
    padding: 0,
    margin: 0,
  }),
});
