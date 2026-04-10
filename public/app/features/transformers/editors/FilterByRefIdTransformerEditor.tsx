import { type TransformerUIProps, FrameMatcherID } from '@grafana/data';
import { type FilterFramesByRefIdTransformerOptions } from '@grafana/data/internal';
import { FrameMultiSelectionEditor } from 'app/plugins/panel/geomap/editor/FrameSelectionEditor';

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
