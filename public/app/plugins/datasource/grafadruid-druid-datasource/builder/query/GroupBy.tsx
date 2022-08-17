import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, useScopedQueryBuilderFieldProps, Multiple, Row } from '../abstract';
import { DataSource } from '../datasource';
import { Dimension } from '../dimension';
import { LimitSpec } from '../limitspec';
import { HavingSpec } from '../havingspec';
import { Granularity } from '../granularity';
import { Filter } from '../filter';
import { Aggregation } from '../aggregation';
import { PostAggregation } from '../postaggregation';
import { Intervals } from '../querysegmentspec';
import { VirtualColumn } from '../virtualcolumn';

export const GroupBy = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, GroupBy);
  const scopedComponentProps = useScopedQueryBuilderProps(props, GroupBy);
  return (
    <>
      <Row>
        <DataSource {...scopedComponentProps('dataSource')} />
      </Row>
      <Row>
        <Intervals {...scopedComponentProps('intervals')} />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('dimensions')}
          label="Dimensions"
          description="The dimensions"
          component={Dimension}
          componentExtraProps={{}}
        />
      </Row>
      <Row>
        <LimitSpec {...scopedComponentProps('limitSpec')} />
      </Row>
      <Row>
        <HavingSpec {...scopedComponentProps('having')} />
      </Row>
      <Row>
        <Granularity {...scopedComponentProps('granularity')} />
      </Row>
      <Row>
        <Filter {...scopedComponentProps('filter')} />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('aggregations')}
          label="Aggregations"
          description="The aggregations"
          component={Aggregation}
          componentExtraProps={{
            label: 'Aggregation',
            description: 'An aggregation',
          }}
        />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('postAggregations')}
          label="Post-aggregations"
          description="The post-aggregations"
          component={PostAggregation}
          componentExtraProps={{
            label: 'Post-aggregation',
            description: 'A post-aggregation',
          }}
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
GroupBy.queryType = 'groupBy';
GroupBy.fields = [
  'dataSource',
  'dimensions',
  'limitSpec',
  'having',
  'granularity',
  'filter',
  'aggregations',
  'postAggregations',
  'intervals',
  'virtualColumns',
];
