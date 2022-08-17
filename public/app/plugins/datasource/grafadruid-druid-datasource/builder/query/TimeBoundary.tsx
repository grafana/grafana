import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, useScopedQueryBuilderFieldProps, Select, Row } from '../abstract';
import { DataSource } from '../datasource';
import { Filter } from '../filter';
import { Intervals } from '../querysegmentspec';

export const TimeBoundary = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, TimeBoundary);
  const scopedComponentProps = useScopedQueryBuilderProps(props, TimeBoundary);
  return (
    <>
      <Row>
        <DataSource {...scopedComponentProps('dataSource')} />
      </Row>
      <Row>
        <Intervals {...scopedComponentProps('intervals')} />
      </Row>
      <Row>
        <Select
          {...scopedProps('bound')}
          label="Bound"
          description="Optional, set to maxTime or minTime to return only the latest or earliest timestamp. Default to returning both if not set"
          entries={{
            minTime: 'Min time',
            maxTime: 'Max time',
          }}
        />
      </Row>
      <Row>
        <Filter {...scopedComponentProps('filter')} />
      </Row>
    </>
  );
};
TimeBoundary.queryType = 'timeBoundary';
TimeBoundary.fields = ['dataSource', 'bound', 'filter', 'intervals'];
