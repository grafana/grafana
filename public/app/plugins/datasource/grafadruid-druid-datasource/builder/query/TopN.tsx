import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, useScopedQueryBuilderFieldProps, Multiple, Input, Row } from '../abstract';
import { DataSource } from '../datasource';
import { Intervals } from '../querysegmentspec';
import { Granularity } from '../granularity';
import { Filter } from '../filter';
import { Aggregation } from '../aggregation';
import { PostAggregation } from '../postaggregation';
import { Dimension } from '../dimension';
import { TopNMetric } from '../topnmetric';
import { VirtualColumn } from '../virtualcolumn';

export const TopN = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, TopN);
  const scopedComponentProps = useScopedQueryBuilderProps(props, TopN);
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
        <Dimension {...scopedProps('dimension')} />
      </Row>
      <Row>
        <Input
          {...scopedProps('threshold')}
          label="Threshold"
          description="How many results in the top list"
          type="number"
        />
      </Row>
      <Row>
        <TopNMetric {...scopedProps('metric')} />
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
TopN.queryType = 'topN';
TopN.fields = [
  'dataSource',
  'intervals',
  'granularity',
  'filter',
  'aggregations',
  'postAggregations',
  'dimension',
  'threshold',
  'metric',
  'virtualColumns',
];
