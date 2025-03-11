import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  FrameMatcherID,
} from '@grafana/data';
import { FilterFramesByRefIdTransformerOptions } from '@grafana/data/src/transformations/transformers/filterByRefId';
import { FrameMultiSelectionEditor } from 'app/plugins/panel/geomap/editor/FrameSelectionEditor';

import { getTransformationContent } from '../docs/getTransformationContent';

export const FilterByRefIdTransformerEditor = (props: TransformerUIProps<FilterFramesByRefIdTransformerOptions>) => {
  return (
    <FrameMultiSelectionEditor
      value={{
        id: FrameMatcherID.byRefId,
        options: props.options.include || '',
      }}
      onChange={(value) => {
        props.onChange({
          ...props.options,
          include: value?.options || '',
        });
      }}
      context={{ data: props.input }}
    />
  );
};

export const filterFramesByRefIdTransformRegistryItem: TransformerRegistryItem<FilterFramesByRefIdTransformerOptions> =
  {
    id: DataTransformerID.filterByRefId,
    editor: FilterByRefIdTransformerEditor,
    transformation: standardTransformers.filterFramesByRefIdTransformer,
    name: standardTransformers.filterFramesByRefIdTransformer.name,
    description:
      'Filter data by query. This is useful if you are sharing the results from a different panel that has many queries and you want to only visualize a subset of that in this panel.',
    categories: new Set([TransformerCategory.Filter]),
    help: getTransformationContent(DataTransformerID.filterByRefId).helperDocs,
  };
