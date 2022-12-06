import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { useStyles2, LoadingPlaceholder } from '@grafana/ui';
import { useGetAllWithFilters } from 'app/features/plugins/admin/state/hooks';

import { CardGrid, CategoryHeader, NoResults, Search } from '../../components';
import { ROUTES } from '../../constants';

const getStyles = () => ({
  spacer: css`
    height: 16px;
  `,
});

export function ConnectData() {
  const [searchTerm, setSearchTerm] = useState('');
  const styles = useStyles2(getStyles);
  const { isLoading, error, plugins } = useGetAllWithFilters({ query: searchTerm, filterBy: '' });

  const cardGridItems = useMemo(
    () =>
      plugins.map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        logo: plugin.info.logos.small,
        url: ROUTES.DataSourcesDetails.replace(':id', plugin.id),
      })),
    [plugins]
  );
  const showNoResults = useMemo(() => !isLoading && !error && plugins.length < 1, [isLoading, error, plugins]);

  return (
    <>
      <Search onChange={setSearchTerm} />
      {/* We need this extra spacing when there are no filters */}
      <div className={styles.spacer} />
      <CategoryHeader iconName="database" label="Data sources" />
      {isLoading ? (
        <LoadingPlaceholder text="Loading..." />
      ) : !!error ? (
        <p>Error: {error.message}</p>
      ) : (
        <CardGrid items={cardGridItems} />
      )}
      {showNoResults && <NoResults />}
    </>
  );
}
