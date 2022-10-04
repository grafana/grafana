import React, { useState } from 'react';

import { useGetAllWithFilters } from 'app/features/plugins/admin/state/hooks';

import { CardGrid } from './CardGrid';
import { CategoryHeader } from './CategoryHeader';
import { NoResults } from './NoResults';
import { Search } from './Search';

export function ConnectData() {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchChange = (e: React.FormEvent<HTMLInputElement>) => {
    setSearchTerm(e.currentTarget.value.toLowerCase());
  };

  const { isLoading, error, plugins } = useGetAllWithFilters({ query: searchTerm, filterBy: '' });

  return (
    <>
      <Search onChange={handleSearchChange} />
      {/* We need this extra spacing when there are no filters */}
      <div margin-bottom="16px" />
      {isLoading ? (
        <div>Loading...</div>
      ) : !!error ? (
        <div>Error: {error.message}</div>
      ) : (
        <>
          <CategoryHeader iconName="database" label="Data sources" />
          <CardGrid plugins={plugins} />
          {plugins.length < 1 && <NoResults />}
        </>
      )}
    </>
  );
}
