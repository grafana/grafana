import React from 'react';
import { QueryBuilderProps } from '../types';
import {
  useScopedQueryBuilderProps,
  useScopedQueryBuilderFieldProps,
  ScopeType,
  Select,
  Checkbox,
  MultiSelect,
  Row,
} from '../abstract';
import { DataSource } from '../datasource';
import { Intervals } from '../querysegmentspec';
import { ToInclude } from '../toinclude';

export const SegmentMetadata = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, SegmentMetadata);
  const scopedComponentProps = useScopedQueryBuilderProps(props, SegmentMetadata);
  return (
    <>
      <Row>
        <DataSource {...scopedComponentProps('dataSource')} />
      </Row>
      <Row>
        <Intervals {...scopedComponentProps('intervals')} />
      </Row>
      <Row>
        <ToInclude {...scopedComponentProps('toInclude')} />
      </Row>
      <Row>
        <MultiSelect
          {...scopedProps('analysisTypes')}
          label="Analysis types"
          description="A list of Strings specifying what column properties (e.g. cardinality, size) should be calculated and returned in the result."
          entries={{
            aggregators: 'Aggregators',
            cardinality: 'Cardinality',
            interval: 'Interval',
            minmax: 'Minmax',
            queryGranularity: 'QueryGranularity',
            rollup: 'rollup',
            size: 'Size',
            timestampSpec: 'TimestampSpec',
          }}
        />
      </Row>
      <Row>
        <Select
          {...scopedProps('view', ScopeType.Settings)}
          label="View"
          description="The view to apply over response rows"
          entries={{
            base: 'Base',
            aggregators: 'Aggregators',
            columns: 'Columns',
            timestampspec: 'TimestampSpec',
          }}
        />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('merge')}
          label="Merge"
          description="Merge all individual segment metadata results into a single result"
        />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('lenientAggregatorMerge')}
          label="Lenient aggregator merge"
          description="Define if aggregators should be merged leniently"
        />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('usingDefaultInterval')}
          label="Using default interval"
          description="Define if it uses the default interval"
        />
      </Row>
    </>
  );
};
SegmentMetadata.queryType = 'segmentMetadata';
SegmentMetadata.fields = [
  'dataSource',
  'intervals',
  'toInclude',
  'merge',
  'analysisTypes',
  'lenientAggregatorMerge',
  'usingDefaultInterval',
];
