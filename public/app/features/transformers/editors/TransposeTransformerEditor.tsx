import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { TransposeTransformerOptions } from '@grafana/data/src/transformations/transformers/transpose';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

export const TransposeTransfomerEditor = ({ options, onChange }: TransformerUIProps<TransposeTransformerOptions>) => {
  return (
    <>
      <InlineFieldRow>
        <InlineField label={'First field name'} labelWidth={24}>
          <Input
            placeholder="Field"
            value={options.firstFieldName}
            onChange={(e) => onChange({ ...options, firstFieldName: e.currentTarget.value })}
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={'Remaining fields name'} tooltip={'Name for value fields'} labelWidth={24}>
          <Input
            placeholder="Value"
            value={options.restFieldsName}
            onChange={(e) => onChange({ ...options, restFieldsName: e.currentTarget.value })}
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

export const transposeTransformerRegistryItem: TransformerRegistryItem<TransposeTransformerOptions> = {
  id: DataTransformerID.transpose,
  editor: TransposeTransfomerEditor,
  transformation: standardTransformers.transposeTransformer,
  name: standardTransformers.transposeTransformer.name,
  description: standardTransformers.transposeTransformer.description,
  categories: new Set([TransformerCategory.Reformat]),
};
