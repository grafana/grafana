import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, Row } from '../abstract';
import { SearchQuerySpec } from '../searchqueryspec';

export const SearchQuery = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderProps(props, SearchQuery);
  return (
    <Row>
      <SearchQuerySpec {...scopedProps('query')} />
    </Row>
  );
};
SearchQuery.type = 'searchQuery';
SearchQuery.fields = ['query'];
