import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { useStyles2, LoadingPlaceholder } from '@grafana/ui';

import { CardGrid, CategoryHeader, NoResults, Search } from '../../../components';
import { ROUTES } from '../../../constants';
import { useGetAll } from '../api';

const getStyles = () => ({
  spacer: css`
    height: 16px;
  `,
});

export function PluginRecipesList() {
  const [searchTerm, setSearchTerm] = useState('');
  const styles = useStyles2(getStyles);

  const handleSearchChange = (e: React.FormEvent<HTMLInputElement>) => {
    setSearchTerm(e.currentTarget.value.toLowerCase());
  };

  const { status, data, error, isFetching } = useGetAll();

  const cardGridItems = useMemo(
    () =>
      (data || []).map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        logo: 'https://grafana.com/api/plugins/simpod-json-datasource/versions/0.5.0/logos/small', // Temporary logo, replace later from META data
        url: ROUTES.PluginRecipeDetails.replace(':id', recipe.id),
      })),
    [data]
  );

  return (
    <>
      <Search onChange={handleSearchChange} />

      {/* We need this extra spacing when there are no filters */}
      <div className={styles.spacer} />

      <CategoryHeader iconName="database" label="Plugin Recipes" />

      {/* Loading */}
      {isFetching && <LoadingPlaceholder text="Loading..." />}

      {/* Error */}
      {error && <p>Error: {error}</p>}

      {/* No results */}
      {!isFetching && cardGridItems.length === 0 && <NoResults />}

      {!isFetching && cardGridItems.length > 0 && <CardGrid items={cardGridItems} />}
    </>
  );
}
