import React, { useCallback, useState } from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  VariableOrigin,
} from '@grafana/data';
import {
  histogramFieldInfo,
  HistogramTransformerInputs,
} from '@grafana/data/src/transformations/transformers/histogram';
import { getTemplateSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';

import { SuggestionsInput } from '../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../utils';

export const HistogramTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<HistogramTransformerInputs>) => {
  const labelWidth = 18;

  const [isInvalid, setInvalid] = useState({
    bucketSize: !numberOrVariableValidator(options.bucketSize || ''),
    bucketOffset: !numberOrVariableValidator(options.bucketOffset || ''),
  });

  const onBucketSizeChanged = useCallback(
    (value: string) => {
      setInvalid({ ...isInvalid, bucketSize: !numberOrVariableValidator(value) });

      onChange({
        ...options,
        bucketSize: value,
      });
    },
    [onChange, options, isInvalid, setInvalid]
  );

  const onBucketOffsetChanged = useCallback(
    (value: string) => {
      setInvalid({ ...isInvalid, bucketOffset: !numberOrVariableValidator(value) });

      onChange({
        ...options,
        bucketOffset: value,
      });
    },
    [onChange, options, isInvalid, setInvalid]
  );

  const onToggleCombine = useCallback(() => {
    onChange({
      ...options,
      combine: !options.combine,
    });
  }, [onChange, options]);

  const templateSrv = getTemplateSrv();
  const variables = templateSrv.getVariables().map((v) => {
    return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
  });

  return (
    <div>
      <InlineFieldRow>
        <InlineField
          invalid={isInvalid.bucketSize}
          error={'Value needs to be an integer or a variable'}
          labelWidth={labelWidth}
          label={histogramFieldInfo.bucketSize.name}
          tooltip={histogramFieldInfo.bucketSize.description}
        >
          <SuggestionsInput
            suggestions={variables}
            value={options.bucketSize}
            placeholder="auto"
            onChange={onBucketSizeChanged}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          labelWidth={labelWidth}
          label={histogramFieldInfo.bucketOffset.name}
          tooltip={histogramFieldInfo.bucketOffset.description}
          invalid={isInvalid.bucketOffset}
          error={'Value needs to be an integer or a variable'}
        >
          <SuggestionsInput
            suggestions={variables}
            value={options.bucketOffset}
            placeholder="none"
            onChange={onBucketOffsetChanged}
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

export const histogramTransformRegistryItem: TransformerRegistryItem<HistogramTransformerInputs> = {
  id: DataTransformerID.histogram,
  editor: HistogramTransformerEditor,
  transformation: standardTransformers.histogramTransformer,
  name: standardTransformers.histogramTransformer.name,
  description: standardTransformers.histogramTransformer.description,
  categories: new Set([TransformerCategory.CreateNewVisualization]),
};
