import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, useScopedQueryBuilderFieldProps, Multiple, Input, Row } from '../abstract';
import { DataSource } from '../datasource';
import { Granularity } from '../granularity';
import { Filter } from '../filter';
import { Intervals } from '../querysegmentspec';
import { Dimension } from '../dimension';
import { SearchQuerySpec } from '../searchqueryspec';
import { SearchSortSpec } from '../searchsortspec';

export const Search = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Search);
  const scopedComponentProps = useScopedQueryBuilderProps(props, Search);
  return (
    <>
      <Row>
        <DataSource {...scopedComponentProps('dataSource')} />
      </Row>
      <Row>
        <Intervals {...scopedComponentProps('intervals')} />
      </Row>
      <Row>
        <Granularity {...scopedComponentProps('granularity')} />
      </Row>
      <Row>
        <Filter {...scopedComponentProps('filter')} />
      </Row>
      <Row>
        <Input {...scopedProps('limit')} label="Limit" description="How many rows to return" type="number" />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('searchDimensions')}
          label="Search dimensions"
          description="The dimensions to run the search over. Excluding this means the search is run over all dimensions."
          component={Dimension}
          componentExtraProps={{}}
        />
      </Row>
      <Row>
        <SearchQuerySpec {...scopedComponentProps('query')} />
      </Row>
      <Row>
        <SearchSortSpec {...scopedComponentProps('sort')} />
      </Row>
    </>
  );
};
Search.queryType = 'search';
Search.fields = ['dataSource', 'granularity', 'filter', 'limit', 'intervals', 'searchDimensions', 'query', 'sort'];
