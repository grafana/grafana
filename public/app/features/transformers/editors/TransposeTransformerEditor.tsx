import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { TransposeTransformerOptions } from '@grafana/data/src/transformations/transformers/transpose';

export const TransposeTransfomerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<TransposeTransformerOptions>) => {
  return null;
};

export const transposeTransformerRegistryItem: TransformerRegistryItem<TransposeTransformerOptions> = {
  id: DataTransformerID.transpose,
  editor: TransposeTransfomerEditor,
  transformation: standardTransformers.transposeTransformer,
  name: standardTransformers.transposeTransformer.name,
  description: standardTransformers.transposeTransformer.description,
  categories: new Set([TransformerCategory.Reformat]),
};
