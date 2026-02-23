import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { SeriesToRowsTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/seriesToRows.svg';
import lightImage from '../images/light/seriesToRows.svg';

export const SeriesToRowsTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<SeriesToRowsTransformerOptions>) => {
  return null;
};

export const getSeriesToRowsTransformerRegistryItem: () => TransformerRegistryItem<SeriesToRowsTransformerOptions> =
  () => ({
    id: DataTransformerID.seriesToRows,
    editor: SeriesToRowsTransformerEditor,
    transformation: standardTransformers.seriesToRowsTransformer,
    name: t('transformers.series-to-rows-transformer-editor.name.series-to-rows', 'Series to rows'),
    description: t(
      'transformers.series-to-rows-transformer-editor.description.merge-multiple-series',
      'Merge multiple series. Return time, metric and values as a row.'
    ),
    categories: new Set([TransformerCategory.Combine, TransformerCategory.Reformat]),
    help: getTransformationContent(DataTransformerID.seriesToRows).helperDocs,
    imageDark: darkImage,
    imageLight: lightImage,
  });
