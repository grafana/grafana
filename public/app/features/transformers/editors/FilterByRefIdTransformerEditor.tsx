import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  FrameMatcherID,
} from '@grafana/data';
import { FilterFramesByRefIdTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { FrameMultiSelectionEditor } from 'app/plugins/panel/geomap/editor/FrameSelectionEditor';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/filterByRefId.svg';
import lightImage from '../images/light/filterByRefId.svg';

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

export const getFilterFramesByRefIdTransformRegistryItem: () => TransformerRegistryItem<FilterFramesByRefIdTransformerOptions> =
  () => ({
    id: DataTransformerID.filterByRefId,
    editor: FilterByRefIdTransformerEditor,
    transformation: standardTransformers.filterFramesByRefIdTransformer,
    name: t('transformers.filter-by-ref-id-transformer-editor.name.filter-data-by-query', 'Filter data by query'),
    description: t(
      'transformers.filter-by-ref-id-transformer-editor.description.filter-data-by-query-useful-sharing-results',
      'Remove rows from the data based on origin query'
    ),
    categories: new Set([TransformerCategory.Filter]),
    help: getTransformationContent(DataTransformerID.filterByRefId).helperDocs,
    imageDark: darkImage,
    imageLight: lightImage,
  });
