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
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { getTransformationContent } from '../docs/getTransformationContent';
import { SuggestionsInput } from '../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../utils';

export const HistogramTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<HistogramTransformerInputs>) => {
  const labelWidth = 18;

  const [isInvalid, setInvalid] = useState({
    bucketCount: !numberOrVariableValidator(options.bucketCount || ''),
    bucketSize: !numberOrVariableValidator(options.bucketSize || ''),
    bucketOffset: !numberOrVariableValidator(options.bucketOffset || ''),
  });

  const onBucketCountChanged = useCallback(
    (val?: number) => {
      onChange({
        ...options,
        bucketCount: val,
      });
    },
    [onChange, options]
  );

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

  const onVariableBucketCountChanged = useCallback(
    (value: string) => {
      setInvalid({ ...isInvalid, bucketCount: !numberOrVariableValidator(value) });

      onChange({
        ...options,
        bucketCount: Number(value) === 0 ? undefined : Number(value),
      });
    },
    [onChange, options, isInvalid]
  );

  const onVariableBucketSizeChanged = useCallback(
    (value: string) => {
      setInvalid({ ...isInvalid, bucketSize: !numberOrVariableValidator(value) });

      onChange({
        ...options,
        bucketSize: value,
      });
    },
    [onChange, options, isInvalid, setInvalid]
  );

  const onVariableBucketOffsetChanged = useCallback(
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

  if (!cfg.featureToggles.transformationsVariableSupport) {
    let bucketSize;
    if (typeof options.bucketSize === 'string') {
      bucketSize = parseInt(options.bucketSize, 10);
    } else {
      bucketSize = options.bucketSize;
    }

    let bucketOffset;
    if (typeof options.bucketOffset === 'string') {
      bucketOffset = parseInt(options.bucketOffset, 10);
    } else {
      bucketOffset = options.bucketOffset;
    }

    return (
      <div>
        <InlineFieldRow>
          <InlineField
            labelWidth={labelWidth}
            label={histogramFieldInfo.bucketCount.name}
            tooltip={histogramFieldInfo.bucketCount.description}
          >
            <NumberInput
              value={options.bucketCount}
              placeholder="Default: 30"
              onChange={onBucketCountChanged}
              min={0}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField
            labelWidth={labelWidth}
            label={histogramFieldInfo.bucketSize.name}
            tooltip={histogramFieldInfo.bucketSize.description}
          >
            <NumberInput value={bucketSize} placeholder="auto" onChange={onBucketSizeChanged} min={0} />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField
            labelWidth={labelWidth}
            label={histogramFieldInfo.bucketOffset.name}
            tooltip={histogramFieldInfo.bucketOffset.description}
          >
            <NumberInput value={bucketOffset} placeholder="none" onChange={onBucketOffsetChanged} min={0} />
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
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField
          invalid={isInvalid.bucketCount}
          error={'Value needs to be an integer or a variable'}
          labelWidth={labelWidth}
          label={histogramFieldInfo.bucketCount.name}
          tooltip={histogramFieldInfo.bucketCount.description}
        >
          <SuggestionsInput
            suggestions={variables}
            value={options.bucketCount}
            placeholder="Default: 30"
            onChange={onVariableBucketCountChanged}
          />
        </InlineField>
      </InlineFieldRow>
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
            onChange={onVariableBucketSizeChanged}
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
            onChange={onVariableBucketOffsetChanged}
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
  help: getTransformationContent(DataTransformerID.histogram).helperDocs,
};
