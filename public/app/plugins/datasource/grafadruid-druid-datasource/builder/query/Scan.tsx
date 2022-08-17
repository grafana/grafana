import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, useScopedQueryBuilderFieldProps, Multiple, Input, Select, Row } from '../abstract';
import { DataSource } from '../datasource';
import { Filter } from '../filter';
import { VirtualColumn } from '../virtualcolumn';
import { Intervals } from '../querysegmentspec';

export const Scan = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Scan);
  const scopedComponentProps = useScopedQueryBuilderProps(props, Scan);
  return (
    <>
      <Row>
        <DataSource {...scopedComponentProps('dataSource')} />
      </Row>
      <Row>
        <Intervals {...scopedComponentProps('intervals')} />
      </Row>
      <Row>
        <Filter {...scopedComponentProps('filter')} />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('columns')}
          label="Columns"
          description="The columns names"
          component={Input}
          componentExtraProps={{
            label: undefined,
            description: 'The column name',
            type: 'text',
          }}
        />
      </Row>
      <Row>
        <Select
          {...scopedProps('order')}
          label="Order"
          description="Specifies the sort order"
          entries={{
            none: 'None',
            ascending: 'Ascending',
            descending: 'Descending',
          }}
        />
        <Input {...scopedProps('limit')} label="Limit" description="How many rows to return" type="number" />
        <Input
          {...scopedProps('batchSize')}
          label="Batch size"
          description="The maximum number of rows buffered"
          type="number"
        />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('virtualColumns')}
          label="Virtual columns"
          description="The virtual columns"
          component={VirtualColumn}
          componentExtraProps={{
            label: 'Virtual column',
            description: 'A virtual column',
          }}
        />
      </Row>
    </>
  );
};
Scan.queryType = 'scan';
Scan.fields = ['dataSource', 'intervals', 'filter', 'columns', 'order', 'limit', 'batchSize', 'virtualColumns'];
