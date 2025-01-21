import { css } from '@emotion/css';
import { compact, uniq, uniqBy } from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import { AppEvents, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getAppEvents, getDataSourceSrv } from '@grafana/runtime';
import { EmptyState, FilterInput, InlineLabel, MultiSelect, Spinner, useStyles2, Stack, Badge } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { createQueryText } from 'app/core/utils/richHistory';
import { useListQueryTemplateQuery } from 'app/features/query-library';
import { getUserInfo } from 'app/features/query-library/api/user';
import { QueryTemplate } from 'app/features/query-library/types';

import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { convertDataQueryResponseToQueryTemplates } from '../../query-library/api/mappers';
import { getK8sNamespace } from '../../query-library/api/query';

import { QueryLibraryProps } from './QueryLibrary';
import { queryLibraryTrackFilterDatasource } from './QueryLibraryAnalyticsEvents';
import { QueryLibraryExpmInfo } from './QueryLibraryExpmInfo';
import QueryTemplatesTable from './QueryTemplatesTable';
import { QueryTemplateRow } from './QueryTemplatesTable/types';
import { searchQueryLibrary } from './utils/search';

interface QueryTemplatesListProps extends QueryLibraryProps {}

export function QueryTemplatesList(props: QueryTemplatesListProps) {
  const {
    data: rawData,
    isLoading,
    error,
  } = useListQueryTemplateQuery({
    namespace: getK8sNamespace(),
  });
  const data = useMemo(() => (rawData ? convertDataQueryResponseToQueryTemplates(rawData) : undefined), [rawData]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [datasourceFilters, setDatasourceFilters] = useState<Array<SelectableValue<string>>>(
    props.activeDatasources?.map((ds) => ({ value: ds, label: ds })) || []
  );
  const [userData, setUserData] = useState<string[]>([]);
  const [userFilters, setUserFilters] = useState<Array<SelectableValue<string>>>([]);

  const [allQueryTemplateRows, setAllQueryTemplateRows] = useState<QueryTemplateRow[]>([]);
  const [isRowsLoading, setIsRowsLoading] = useState(true);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    let shouldCancel = true;

    const fetchRows = async () => {
      if (!data) {
        setIsRowsLoading(false);
        return;
      }

      let userDataList;
      const userQtList = uniq(compact(data.map((qt) => qt.user?.uid)));
      const usersParam = userQtList.map((userUid) => `key=${encodeURIComponent(userUid)}`).join('&');
      try {
        userDataList = await getUserInfo(`?${usersParam}`);
      } catch (error) {
        getAppEvents().publish({
          type: AppEvents.alertError.name,
          payload: [
            t('query-library.user-info-get-error', 'Error attempting to get user info from the library: {{error}}', {
              error: JSON.stringify(error),
            }),
          ],
        });
        setIsRowsLoading(false);
        return;
      }

      setUserData(userDataList.display.map((user) => user.displayName));

      const rowsPromises = data.map(async (queryTemplate: QueryTemplate, index: number) => {
        try {
          const datasourceRef = queryTemplate.targets[0]?.datasource;
          const datasourceApi = await getDataSourceSrv().get(datasourceRef);
          const datasourceType = getDatasourceSrv().getInstanceSettings(datasourceRef)?.meta.name || '';
          const query = queryTemplate.targets[0];
          const queryText = createQueryText(query, datasourceApi);
          const datasourceName = datasourceApi?.name || '';
          const extendedUserData = userDataList.display.find(
            (user) => `${user?.identity.type}:${user?.identity.name}` === queryTemplate.user?.uid
          );

          return {
            index: index.toString(),
            uid: queryTemplate.uid,
            datasourceName,
            datasourceRef,
            datasourceType,
            createdAtTimestamp: queryTemplate?.createdAtTimestamp || 0,
            query,
            queryText,
            description: queryTemplate.title,
            user: {
              uid: queryTemplate.user?.uid || '',
              displayName: extendedUserData?.displayName || '',
              avatarUrl: extendedUserData?.avatarUrl || '',
            },
          };
        } catch (error) {
          getAppEvents().publish({
            type: AppEvents.alertError.name,
            payload: [
              t(
                'query-library.query-template-get-error',
                'Error attempting to get query template from the library: {{error}}',
                { error: JSON.stringify(error) }
              ),
            ],
          });
          return { index: index.toString(), error };
        }
      });

      const results = await Promise.allSettled(rowsPromises);
      const rows = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);

      if (shouldCancel) {
        setAllQueryTemplateRows(rows);
        setIsRowsLoading(false);
      }
    };

    fetchRows();

    return () => {
      shouldCancel = false;
    };
  }, [data]);

  const queryTemplateRows = useMemo(
    () =>
      searchQueryLibrary(
        allQueryTemplateRows,
        searchQuery,
        datasourceFilters.map((f) => f.value || ''),
        userFilters.map((f) => f.value || '')
      ),
    [allQueryTemplateRows, searchQuery, datasourceFilters, userFilters]
  );

  const datasourceNames = useMemo(() => {
    return uniqBy(allQueryTemplateRows, 'datasourceName').map((row) => row.datasourceName);
  }, [allQueryTemplateRows]);

  if (error) {
    return (
      <EmptyState variant="not-found" message={`Something went wrong`}>
        {error.message}
      </EmptyState>
    );
  }

  if (isLoading || isRowsLoading) {
    return <Spinner />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState message={`Query Library`} variant="not-found">
        <p>
          {
            "You haven't saved any queries to your library yet. Start adding them from Explore or your Query History tab."
          }
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <QueryLibraryExpmInfo isOpen={isModalOpen} onDismiss={() => setIsModalOpen(false)} />
      <Stack gap={0.5}>
        <FilterInput
          className={styles.searchInput}
          placeholder={t('query-library.search', 'Search by data source, query content or description')}
          aria-label={t('query-library.search', 'Search by data source, query content or description')}
          value={searchQuery}
          onChange={(query) => setSearchQuery(query)}
          escapeRegex={false}
        />
        <InlineLabel className={styles.label} width="auto">
          <Trans i18nKey="query-library.datasource-names">Datasource name(s):</Trans>
        </InlineLabel>
        <MultiSelect
          className={styles.multiSelect}
          onChange={(items, actionMeta) => {
            setDatasourceFilters(items);
            actionMeta.action === 'select-option' && queryLibraryTrackFilterDatasource();
          }}
          value={datasourceFilters}
          options={datasourceNames.map((r) => {
            return { value: r, label: r };
          })}
          placeholder={'Filter queries for data sources(s)'}
          aria-label={'Filter queries for data sources(s)'}
        />
        <InlineLabel className={styles.label} width="auto">
          <Trans i18nKey="query-library.user-names">User name(s):</Trans>
        </InlineLabel>
        <MultiSelect
          className={styles.multiSelect}
          onChange={(items, actionMeta) => {
            setUserFilters(items);
            actionMeta.action === 'select-option' && queryLibraryTrackFilterDatasource();
          }}
          value={userFilters}
          options={userData.map((r) => {
            return { value: r, label: r };
          })}
          placeholder={'Filter queries for user name(s)'}
          aria-label={'Filter queries for user name(s)'}
        />
        <Badge
          text=""
          icon="info"
          aria-label="info"
          tooltip={'Click here for more informationn about Query library'}
          color="blue"
          style={{ cursor: 'pointer' }}
          onClick={() => setIsModalOpen(true)}
        />
      </Stack>
      <QueryTemplatesTable queryTemplateRows={queryTemplateRows} />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  searchInput: css({
    maxWidth: theme.spacing(55),
  }),
  multiSelect: css({
    maxWidth: theme.spacing(65),
  }),
  label: css({
    marginLeft: theme.spacing(1),
    border: `1px solid ${theme.colors.secondary.border}`,
  }),
});
