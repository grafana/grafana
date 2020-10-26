import { InlineField, Input, Select } from '@grafana/ui';
import React, { ComponentProps, FunctionComponent } from 'react';
import { useDispatch } from '../../ElasticsearchQueryContext';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { BucketAggregation, BucketAggregationAction } from '../state/types';

const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 16,
};

// TODO: Move the following somewhere else
const orderOptions = [
  { label: 'Top', value: 'desc' },
  { label: 'Bottom', value: 'asc' },
];

const sizeOptions = [
  { label: 'No limit', value: '0' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '5', value: '5' },
  { label: '10', value: '10' },
  { label: '15', value: '15' },
  { label: '20', value: '20' },
];

const orderByOptions = [
  { label: 'Doc Count', value: '_count' },
  { label: 'Term value', value: '_term' },
];

interface Props {
  bucketAgg: BucketAggregation;
}

export const SettingsEditor: FunctionComponent<Props> = ({ bucketAgg }) => {
  const dispatch = useDispatch<BucketAggregationAction>();

  return (
    <SettingsEditorContainer label="Settings">
      {bucketAgg.type === 'terms' && (
        <>
          <InlineField label="Order" {...inlineFieldProps}>
            <Select
              // TODO: onBlur
              onChange={() => {}}
              options={orderOptions}
              defaultValue={bucketAgg.settings?.order}
            />
          </InlineField>

          <InlineField label="Size" {...inlineFieldProps}>
            <Select
              // TODO: onChange
              onChange={() => {}}
              options={sizeOptions}
              defaultValue={bucketAgg.settings?.size}
              allowCustomValue
            />
          </InlineField>

          <InlineField label="Min Doc Count" {...inlineFieldProps}>
            <Input
              // TODO: onBlur
              onBlur={() => {}}
              defaultValue={bucketAgg.settings?.min_doc_count ?? '0'}
            />
          </InlineField>

          <InlineField label="Order By" {...inlineFieldProps}>
            <Select
              // TODO: onChange
              onChange={() => {}}
              // TODO: This can also select from previously selected metrics
              options={orderByOptions}
              defaultValue={bucketAgg.settings?.orderBy}
            />
          </InlineField>

          <InlineField label="Missing" {...inlineFieldProps}>
            <Input
              // TODO: onBlur
              onBlur={() => {}}
              defaultValue={bucketAgg.settings?.missing}
            />
          </InlineField>
        </>
      )}
    </SettingsEditorContainer>
  );
};
