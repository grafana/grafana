import React, { useState } from 'react';

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
      <DataSourcePluginList searchTerm={searchTerm} />
    </>
  );
}
