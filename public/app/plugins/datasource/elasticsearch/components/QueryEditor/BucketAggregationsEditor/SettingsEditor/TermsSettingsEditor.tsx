import React from 'react';
import { InlineField, Select, Input } from '@grafana/ui';
import { Terms } from '../aggregations';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { inlineFieldProps } from '.';
import { bucketAggregationConfig, createOrderByOptionsFromMetrics, orderOptions, sizeOptions } from '../utils';
import { useCreatableSelectPersistedBehaviour } from '../../../hooks/useCreatableSelectPersistedBehaviour';
import { changeBucketAggregationSetting } from '../state/actions';
import { useQuery } from '../../ElasticsearchQueryContext';

interface Props {
  bucketAgg: Terms;
}

export const TermsSettingsEditor = ({ bucketAgg }: Props) => {
  const { metrics } = useQuery();
  const orderBy = createOrderByOptionsFromMetrics(metrics);

  const dispatch = useDispatch();

  return (
    <>
      <InlineField label="Order" {...inlineFieldProps}>
        <Select
          onChange={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'order', e.value!))}
          options={orderOptions}
          value={bucketAgg.settings?.order || bucketAggregationConfig.terms.defaultSettings?.order}
        />
      </InlineField>

      <InlineField label="Size" {...inlineFieldProps}>
        <Select
          // TODO: isValidNewOption should only allow numbers & template variables
          {...useCreatableSelectPersistedBehaviour({
            options: sizeOptions,
            value: bucketAgg.settings?.size || bucketAggregationConfig.terms.defaultSettings?.size,
            onChange(value) {
              dispatch(changeBucketAggregationSetting(bucketAgg, 'size', value));
            },
          })}
        />
      </InlineField>

      <InlineField label="Min Doc Count" {...inlineFieldProps}>
        <Input
          onBlur={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'min_doc_count', e.target.value!))}
          defaultValue={
            bucketAgg.settings?.min_doc_count || bucketAggregationConfig.terms.defaultSettings?.min_doc_count
          }
        />
      </InlineField>

      <InlineField label="Order By" {...inlineFieldProps}>
        <Select
          onChange={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'orderBy', e.value!))}
          options={orderBy}
          value={bucketAgg.settings?.orderBy || bucketAggregationConfig.terms.defaultSettings?.orderBy}
        />
      </InlineField>

      <InlineField label="Missing" {...inlineFieldProps}>
        <Input
          onBlur={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'missing', e.target.value!))}
          defaultValue={bucketAgg.settings?.missing || bucketAggregationConfig.terms.defaultSettings?.missing}
        />
      </InlineField>
    </>
  );
};
