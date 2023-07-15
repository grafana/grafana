import { uniqueId } from 'lodash';
import React, { useRef } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, Select, Input } from '@grafana/ui';

import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { MetricAggregation, Percentiles, ExtendedStatMetaType, ExtendedStats, Terms } from '../../../../types';
import { describeMetric } from '../../../../utils';
import { useCreatableSelectPersistedBehaviour } from '../../../hooks/useCreatableSelectPersistedBehaviour';
import { useQuery } from '../../ElasticsearchQueryContext';
import { isPipelineAggregation } from '../../MetricAggregationsEditor/aggregations';
import { changeBucketAggregationSetting } from '../state/actions';
import { bucketAggregationConfig, orderByOptions, orderOptions, sizeOptions } from '../utils';

import { inlineFieldProps } from '.';

interface Props {
  bucketAgg: Terms;
}

export const TermsSettingsEditor = ({ bucketAgg }: Props) => {
  const { metrics } = useQuery();
  const orderBy = createOrderByOptions(metrics);
  const { current: baseId } = useRef(uniqueId('es-terms-'));

  const dispatch = useDispatch();

  return (
    <>
      <InlineField label="Order" {...inlineFieldProps}>
        <Select
          inputId={`${baseId}-order`}
          onChange={(e) =>
            dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'order', newValue: e.value }))
          }
          options={orderOptions}
          value={bucketAgg.settings?.order || bucketAggregationConfig.terms.defaultSettings?.order}
        />
      </InlineField>

      <InlineField label="Size" {...inlineFieldProps}>
        <Select
          inputId={`${baseId}-size`}
          // TODO: isValidNewOption should only allow numbers & template variables
          {...useCreatableSelectPersistedBehaviour({
            options: sizeOptions,
            value: bucketAgg.settings?.size || bucketAggregationConfig.terms.defaultSettings?.size,
            onChange({ value }) {
              dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'size', newValue: value }));
            },
          })}
        />
      </InlineField>

      <InlineField label="Min Doc Count" {...inlineFieldProps}>
        <Input
          id={`${baseId}-min_doc_count`}
          onBlur={(e) =>
            dispatch(
              changeBucketAggregationSetting({ bucketAgg, settingName: 'min_doc_count', newValue: e.target.value })
            )
          }
          defaultValue={
            bucketAgg.settings?.min_doc_count || bucketAggregationConfig.terms.defaultSettings?.min_doc_count
          }
        />
      </InlineField>

      <InlineField label="Order By" {...inlineFieldProps}>
        <Select
          inputId={`${baseId}-order_by`}
          onChange={(e) =>
            dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'orderBy', newValue: e.value }))
          }
          options={orderBy}
          value={bucketAgg.settings?.orderBy || bucketAggregationConfig.terms.defaultSettings?.orderBy}
        />
      </InlineField>

      <InlineField label="Missing" {...inlineFieldProps}>
        <Input
          id={`${baseId}-missing`}
          onBlur={(e) =>
            dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'missing', newValue: e.target.value }))
          }
          defaultValue={bucketAgg.settings?.missing || bucketAggregationConfig.terms.defaultSettings?.missing}
        />
      </InlineField>
    </>
  );
};

/**
 * This returns the valid options for each of the enabled extended stat
 */
function createOrderByOptionsForExtendedStats(metric: ExtendedStats): SelectableValue<string> {
  if (!metric.meta) {
    return [];
  }
  const metaKeys = Object.keys(metric.meta) as ExtendedStatMetaType[];
  return metaKeys
    .filter((key) => metric.meta?.[key])
    .map((key) => {
      let method = key as string;
      // The bucket path for std_deviation_bounds.lower and std_deviation_bounds.upper
      // is accessed via std_lower and std_upper, respectively.
      if (key === 'std_deviation_bounds_lower') {
        method = 'std_lower';
      }
      if (key === 'std_deviation_bounds_upper') {
        method = 'std_upper';
      }
      return { label: `${describeMetric(metric)} (${method})`, value: `${metric.id}[${method}]` };
    });
}

/**
 * This returns the valid options for each of the percents listed in the percentile settings
 */
function createOrderByOptionsForPercentiles(metric: Percentiles): Array<SelectableValue<string>> {
  if (!metric.settings?.percents) {
    return [];
  }
  return metric.settings.percents.map((percent) => {
    // The bucket path for percentile numbers is appended with a `.0` if the number is whole
    // otherwise you have to use the actual value.
    const percentString = /^\d+\.\d+/.test(`${percent}`) ? percent : `${percent}.0`;
    return { label: `${describeMetric(metric)} (${percent})`, value: `${metric.id}[${percentString}]` };
  });
}

function isValidOrderTarget(metric: MetricAggregation) {
  return (
    // top metrics can't be used for ordering
    metric.type !== 'top_metrics' &&
    // pipeline aggregations can't be used for ordering: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html#search-aggregations-bucket-terms-aggregation-order
    !isPipelineAggregation(metric)
  );
}

/**
 * This creates all the valid order by options based on the metrics
 */
export const createOrderByOptions = (metrics: MetricAggregation[] = []): Array<SelectableValue<string>> => {
  const metricOptions = metrics.filter(isValidOrderTarget).flatMap((metric) => {
    if (metric.type === 'extended_stats') {
      return createOrderByOptionsForExtendedStats(metric);
    } else if (metric.type === 'percentiles') {
      return createOrderByOptionsForPercentiles(metric);
    } else {
      return { label: describeMetric(metric), value: metric.id };
    }
  });
  return [...orderByOptions, ...metricOptions];
};
