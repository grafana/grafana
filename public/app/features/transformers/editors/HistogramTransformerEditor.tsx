import React, { useCallback } from 'react';

import { DataTransformerID, standardTransformers, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import {
  HistogramTransformerOptions,
  histogramFieldInfo,
} from '@grafana/data/src/transformations/transformers/histogram';
import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

export const HistogramTransformerEditor: React.FC<TransformerUIProps<HistogramTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const labelWidth = 18;

  const onBucketSizeChanged = useCallback(
    (val?: number) => {
      onChange({
        ...options,
        bucketSize: val,
      });
    },
    [onChange, options]
  );

  const onBucketOffsetChanged = useCallback(
    (val?: number) => {
      onChange({
        ...options,
        bucketOffset: val,
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
          <NumberInput value={options.bucketSize} placeholder="auto" onChange={onBucketSizeChanged} min={0} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          labelWidth={labelWidth}
          label={histogramFieldInfo.bucketOffset.name}
          tooltip={histogramFieldInfo.bucketOffset.description}
        >
          <NumberInput value={options.bucketOffset} placeholder="none" onChange={onBucketOffsetChanged} min={0} />
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
