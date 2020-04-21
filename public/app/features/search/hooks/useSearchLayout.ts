import { useEffect, useState } from 'react';
import { SearchLayout } from '../types';

const layoutOptions = [
  { label: 'Folders', value: SearchLayout.Folders },
  { label: 'List', value: SearchLayout.List },
];

export const useSearchLayout = (query: any) => {
  const [layout, setLayout] = useState<string>(layoutOptions[0].value);

  useEffect(() => {
    if (query.sort) {
      const list = layoutOptions.find(opt => opt.value === SearchLayout.List);
      setLayout(list!.value);
    }
  }, [query]);

  return { layout, setLayout, layoutOptions };
};
