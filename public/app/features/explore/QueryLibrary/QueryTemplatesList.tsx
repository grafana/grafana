import { css } from '@emotion/css';
import { uniqBy } from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import { AppEvents, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { EmptyState, FilterInput, InlineLabel, MultiSelect, Spinner, useStyles2, Stack, Badge } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { useListQueryTemplateQuery } from 'app/features/query-library';
import { QueryTemplate } from 'app/features/query-library/types';

import { convertDataQueryResponseToQueryTemplates } from '../../query-library/api/mappers';
import { UserDataQueryResponse } from '../../query-library/api/types';

import { QueryLibraryProps } from './QueryLibrary';
import { queryLibraryTrackFilterDatasource } from './QueryLibraryAnalyticsEvents';
import { QueryLibraryExpmInfo } from './QueryLibraryExpmInfo';
import QueryTemplatesTable from './QueryTemplatesTable';
import { useLoadQueryMetadata, useLoadUsers } from './utils/dataFetching';
import { searchQueryLibrary } from './utils/search';

interface QueryTemplatesListProps extends QueryLibraryProps {}

export function QueryTemplatesList(props: QueryTemplatesListProps) {
  const { data: rawData, isLoading, error } = useListQueryTemplateQuery({});
  const data = useMemo(() => (rawData ? convertDataQueryResponseToQueryTemplates(rawData) : undefined), [rawData]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [datasourceFilters, setDatasourceFilters] = useState<Array<SelectableValue<string>>>(
    props.activeDatasources?.map((ds) => ({ value: ds, label: ds })) || []
  );
  const [userFilters, setUserFilters] = useState<Array<SelectableValue<string>>>([]);
  const styles = useStyles2(getStyles);

  const loadUsersResult = useLoadUsersWithError(data);
  const userNames = loadUsersResult.value ? loadUsersResult.value.display.map((user) => user.displayName) : [];

  const loadQueryMetadataResult = useLoadQueryMetadataWithError(data, loadUsersResult.value);

  // Filtering right now is done just on the frontend until there is better backend support for this.
  const filteredRows = useMemo(
    () =>
      searchQueryLibrary(
        loadQueryMetadataResult.value || [],
        searchQuery,
        datasourceFilters.map((f) => f.value || ''),
        userFilters.map((f) => f.value || '')
      ),
    [loadQueryMetadataResult.value, searchQuery, datasourceFilters, userFilters]
  );

  const datasourceNames = useMemo(() => {
    return uniqBy(loadQueryMetadataResult.value, 'datasourceName').map((row) => row.datasourceName);
  }, [loadQueryMetadataResult.value]);

  if (error instanceof Error) {
    return (
      <EmptyState variant="not-found" message={`Something went wrong`}>
        {error.message}
      </EmptyState>
    );
  }

  if (isLoading || loadUsersResult.loading || loadQueryMetadataResult.loading) {
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
          isLoading={loadUsersResult.loading}
          className={styles.multiSelect}
          onChange={(items, actionMeta) => {
            setUserFilters(items);
            actionMeta.action === 'select-option' && queryLibraryTrackFilterDatasource();
          }}
          value={userFilters}
          options={userNames.map((r) => {
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
      <QueryTemplatesTable queryTemplateRows={filteredRows} queryActionButton={props.queryActionButton} />
    </>
  );
}

/**
 * Wrap useLoadUsers with error handling.
 * @param data
 */
function useLoadUsersWithError(data: QueryTemplate[] | undefined) {
  const userUIDs = useMemo(() => data?.map((qt) => qt.user?.uid).filter((uid) => uid !== undefined), [data]);
  const loadUsersResult = useLoadUsers(userUIDs);
  useEffect(() => {
    if (loadUsersResult.error) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('query-library.user-info-get-error', 'Error attempting to get user info from the library: {{error}}', {
            error: JSON.stringify(loadUsersResult.error),
          }),
        ],
      });
    }
  }, [loadUsersResult.error]);
  return loadUsersResult;
}

/**
 * Wrap useLoadQueryMetadata with error handling.
 * @param queryTemplates
 * @param userDataList
 */
function useLoadQueryMetadataWithError(
  queryTemplates: QueryTemplate[] | undefined,
  userDataList: UserDataQueryResponse | undefined
) {
  const result = useLoadQueryMetadata(queryTemplates, userDataList);

  // useLoadQueryMetadata returns errors in the values so we filter and group them and later alert only one time for
  // all the errors. This way we show data that is loaded even if some rows errored out.
  // TODO: maybe we could show the rows with incomplete data to see exactly which ones errored out. I assume this
  //  can happen for example when data source for saved query was deleted. Would be nice if user would still be able
  //  to delete such row or decide what to do.
  const [values, errors] = useMemo(() => {
    let errors: Error[] = [];
    let values = [];
    if (!result.loading) {
      for (const value of result.value!) {
        if (value.error) {
          errors.push(value.error);
        } else {
          values.push(value);
        }
      }
    }
    return [values, errors];
  }, [result]);

  useEffect(() => {
    if (errors.length) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('query-library.query-template-get-error', 'Error attempting to load query template metadata: {{error}}', {
            error: JSON.stringify(errors),
          }),
        ],
      });
    }
  }, [errors]);

  return {
    loading: result.loading,
    value: values,
  };
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
