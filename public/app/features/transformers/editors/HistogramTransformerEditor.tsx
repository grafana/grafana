import React, { FormEvent, useCallback } from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';

import {
  HistogramTransformerOptions,
  histogramFieldInfo,
} from '@grafana/data/src/transformations/transformers/histogram';
import { InlineField, InlineFieldRow, InlineSwitch, Input } from '@grafana/ui';

export const HistogramTransformerEditor: React.FC<TransformerUIProps<HistogramTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const labelWidth = 18;

  const onBucketSizeChanged = useCallback(
    (evt: FormEvent<HTMLInputElement>) => {
      const val = evt.currentTarget.valueAsNumber;
      onChange({
        ...options,
        bucketSize: isNaN(val) || val < 0 ? undefined : val,
      });
    },
    [onChange, options]
  );

  const onBucketOffsetChanged = useCallback(
    (evt: FormEvent<HTMLInputElement>) => {
      const val = evt.currentTarget.valueAsNumber;
      onChange({
        ...options,
        bucketOffset: isNaN(val) || val < 0 ? undefined : val,
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
          <Input
            type="number"
            value={options.bucketSize ?? ''}
            placeholder="auto"
            onChange={onBucketSizeChanged}
            min={0}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          labelWidth={labelWidth}
          label={histogramFieldInfo.bucketOffset.name}
          tooltip={histogramFieldInfo.bucketOffset.description}
        >
          <Input
            type="number"
            value={options.bucketOffset}
            placeholder="none"
            onChange={onBucketOffsetChanged}
            min={0}
          />
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

export const histogramTransformRegistryItem: TransformerRegistryItem<HistogramTransformerOptions> = {
  id: DataTransformerID.histogram,
  editor: HistogramTransformerEditor,
  transformation: standardTransformers.histogramTransformer,
  name: standardTransformers.histogramTransformer.name,
  description: standardTransformers.histogramTransformer.description,
};
