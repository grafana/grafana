import { PluginState, standardTransformers, TransformerCategory, type TransformerRegistryItem } from '@grafana/data';
import {
  DataTransformerID,
  type GroupToNestedTableTransformerOptions,
  type GroupToNestedTableTransformerOptionsV2,
} from '@grafana/data/internal';
import { t } from '@grafana/i18n';

import darkImage from '../images/dark/groupToNestedTable.svg';
import lightImage from '../images/light/groupToNestedTable.svg';

import { GroupToNestedTableTransformerEditor } from './Editor';

export const getGroupToNestedTableTransformRegistryItem: () => TransformerRegistryItem<
  GroupToNestedTableTransformerOptions | GroupToNestedTableTransformerOptionsV2
> = () => ({
  id: DataTransformerID.groupToNestedTable,
  editor: GroupToNestedTableTransformerEditor,
  transformation: standardTransformers.groupToNestedTable,
  name: t(
    'transformers.group-to-nested-table-transformer-editor.name.group-to-nested-tables',
    'Group to nested tables'
  ),
  description: t(
    'transformers.group-to-nested-table-transformer-editor.description.group-by-field-value',
    'Group data by a field value and create nested tables with the grouped data.'
  ),
  categories: new Set([
    TransformerCategory.Combine,
    TransformerCategory.CalculateNewFields,
    TransformerCategory.Reformat,
  ]),
  state: PluginState.beta,
  imageDark: darkImage,
  imageLight: lightImage,
});
