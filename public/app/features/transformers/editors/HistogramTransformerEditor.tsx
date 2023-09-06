import React, { FormEvent, useCallback } from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import {
  histogramFieldInfo,
  HistogramTransformerInputs,
} from '@grafana/data/src/transformations/transformers/histogram';
import { InlineField, InlineFieldRow, InlineSwitch, Input } from '@grafana/ui';

export const HistogramTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<HistogramTransformerInputs>) => {
  const labelWidth = 18;

  const onBucketSizeChanged = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      onChange({
        ...options,
        bucketSize: event?.currentTarget.value,
      });
    },
    [onChange, options]
  );

  const onBucketOffsetChanged = useCallback(
    (event?: FormEvent<HTMLInputElement>) => {
      onChange({
        ...options,
        bucketOffset: event?.currentTarget.value,
      });
    },
    [onChange, options]
  );

  const onToggleCombine = useCallback(() => {
    onChange({
      ...options,
      combine: !options.combine,
    });
  }, [onChange, options]);

  return (
    <div>
      <InlineFieldRow>
        <InlineField
          labelWidth={labelWidth}
          label={histogramFieldInfo.bucketSize.name}
          tooltip={histogramFieldInfo.bucketSize.description}
        >
          <Input value={options.bucketSize} placeholder="auto" onChange={onBucketSizeChanged} min={0} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          labelWidth={labelWidth}
          label={histogramFieldInfo.bucketOffset.name}
          tooltip={histogramFieldInfo.bucketOffset.description}
        >
          <Input value={options.bucketOffset} placeholder="none" onChange={onBucketOffsetChanged} min={0} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          labelWidth={labelWidth}
          label={histogramFieldInfo.combine.name}
          tooltip={histogramFieldInfo.combine.description}
        >
          <InlineSwitch value={options.combine ?? false} onChange={onToggleCombine} />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
};

export const histogramTransformRegistryItem: TransformerRegistryItem<HistogramTransformerInputs> = {
  id: DataTransformerID.histogram,
  editor: HistogramTransformerEditor,
  transformation: standardTransformers.histogramTransformer,
  name: standardTransformers.histogramTransformer.name,
  description: standardTransformers.histogramTransformer.description,
  categories: new Set([TransformerCategory.CreateNewVisualization]),
};
