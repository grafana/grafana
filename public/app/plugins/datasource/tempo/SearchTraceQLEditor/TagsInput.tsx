import React, { useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { FetchError } from '@grafana/runtime';
import { HorizontalGroup, VerticalGroup, Button } from '@grafana/ui';

import { TempoDatasource } from '../datasource';
import { SearchFilter } from '../types';

import SearchField from './SearchField';

interface Props {
  updateFilter: (f: SearchFilter) => void;
  filters: SearchFilter[];
  datasource: TempoDatasource;
  setError: (error: FetchError) => void;
  tags: string[];
  isTagsLoading: boolean;
}
const TagsInput = ({ updateFilter, filters, datasource, setError, tags, isTagsLoading }: Props) => {
  const handleOnAdd = useCallback(() => updateFilter({ id: uuidv4(), type: 'dynamic', operator: '=' }), [updateFilter]);

  useEffect(() => {
    if (!filters.find((f) => f.type === 'dynamic')) {
      handleOnAdd();
    }
  }, [filters, handleOnAdd]);

  return (
    <HorizontalGroup spacing={'xs'} align={'flex-start'}>
      <VerticalGroup spacing={'xs'}>
        {filters
          .filter((f) => f.type === 'dynamic')
          .map((f) => (
            <SearchField
              filter={f}
              key={f.id}
              datasource={datasource}
              setError={setError}
              updateFilter={updateFilter}
              tags={tags}
              isTagsLoading={isTagsLoading}
            />
          ))}
      </VerticalGroup>
      <Button onClick={handleOnAdd}>+</Button>
    </HorizontalGroup>
  );
};

export default TagsInput;
