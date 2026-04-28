import { type TransformerUIProps } from '@grafana/data';
import {
  type GroupToNestedTableTransformerOptions,
  type GroupToNestedTableTransformerOptionsV2,
  isV1GroupToNestedTableOptions,
} from '@grafana/data/internal';
import { config } from '@grafana/runtime';

import { GroupToNestedTableTransformerEditorV1 } from './EditorV1';
import { GroupToNestedTableTransformerEditorV2 } from './EditorV2';

export const GroupToNestedTableTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<GroupToNestedTableTransformerOptions | GroupToNestedTableTransformerOptionsV2>) => {
  // if the config is already saved in v2 format, show the new editor to avoid issues.
  if (config.featureToggles.groupToNestedTableV2 || !isV1GroupToNestedTableOptions(options)) {
    return <GroupToNestedTableTransformerEditorV2 input={input} options={options} onChange={onChange} />;
  }

  return <GroupToNestedTableTransformerEditorV1 input={input} options={options} onChange={onChange} />;
};
