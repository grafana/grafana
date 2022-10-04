import React, { useState } from 'react';

import { CategoryHeader } from './CategoryHeader';
import { DataSourcePluginList } from './DataSourcePluginList';
import { Search } from './Search';

export function ConnectData() {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchChange = (e: React.FormEvent<HTMLInputElement>) => {
    setSearchTerm(e.currentTarget.value.toLowerCase());
  };

  return (
    <>
      <Search onChange={handleSearchChange} />
      {/* We need this extra spacing when there are no filters */}
      <div margin-bottom="16px" />
      <CategoryHeader iconName="database" label="Data sources" />
      <DataSourcePluginList searchTerm={searchTerm} />
    </>
  );
}
