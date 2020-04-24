import { useEffect, useState } from 'react';
import { DashboardQuery, SearchLayout } from '../types';

export const layoutOptions = [
  { label: 'Folders', value: SearchLayout.Folders, icon: 'folder' },
  { label: 'List', value: SearchLayout.List, icon: 'list-ul' },
];

export const useSearchLayout = (query: DashboardQuery, defaultLayout = SearchLayout.Folders) => {
  const [layout, setLayout] = useState<string>(defaultLayout);

  useEffect(() => {
    if (query.sort) {
      const list = layoutOptions.find(opt => opt.value === SearchLayout.List);
      setLayout(list!.value);
    }
  }, [query]);

  return { layout, setLayout };
};
