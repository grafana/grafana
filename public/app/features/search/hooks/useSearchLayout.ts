import { useEffect, useState } from 'react';
import { SearchLayout } from '../types';

export const layoutOptions = [
  { label: 'Folders', value: SearchLayout.Folders, icon: 'folder' },
  { label: 'List', value: SearchLayout.List, icon: 'list-ul' },
];

export const useSearchLayout = (query: any) => {
  const [layout, setLayout] = useState<string>(layoutOptions[0].value);

  useEffect(() => {
    if (query.sort) {
      const list = layoutOptions.find(opt => opt.value === SearchLayout.List);
      setLayout(list!.value);
    }
  }, [query]);

  return { layout, setLayout };
};
