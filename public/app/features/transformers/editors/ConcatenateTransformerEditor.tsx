import { PureComponent, ChangeEvent } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import {
  ConcatenateFrameNameMode,
  ConcatenateTransformerOptions,
} from '@grafana/data/src/transformations/transformers/concat';
import { InlineField, Input, Select } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';

interface ConcatenateTransformerEditorProps extends TransformerUIProps<ConcatenateTransformerOptions> {}

const nameModes: Array<SelectableValue<ConcatenateFrameNameMode>> = [
  { value: ConcatenateFrameNameMode.FieldName, label: 'Copy frame name to field name' },
  { value: ConcatenateFrameNameMode.Label, label: 'Add a label with the frame name' },
  { value: ConcatenateFrameNameMode.Drop, label: 'Ignore the frame name' },
];

export class ConcatenateTransformerEditor extends PureComponent<ConcatenateTransformerEditorProps> {
  constructor(props: ConcatenateTransformerEditorProps) {
    super(props);
  }

  onModeChanged = (value: SelectableValue<ConcatenateFrameNameMode>) => {
    const { options, onChange } = this.props;
    const frameNameMode = value.value ?? ConcatenateFrameNameMode.FieldName;
    onChange({
      ...options,
      frameNameMode,
    });
  };

  onLabelChanged = (evt: ChangeEvent<HTMLInputElement>) => {
    const { options } = this.props;
    this.props.onChange({
      ...options,
      frameNameLabel: evt.target.value,
    });
  };

  //---------------------------------------------------------
  // Render
  //---------------------------------------------------------

  render() {
    const { options } = this.props;

    const frameNameMode = options.frameNameMode ?? ConcatenateFrameNameMode.FieldName;

    return (
      <div>
        <InlineField label="Name" labelWidth={16} grow>
          <Select
            width={36}
            options={nameModes}
            value={nameModes.find((v) => v.value === frameNameMode)}
            onChange={this.onModeChanged}
          />
        </InlineField>
        {frameNameMode === ConcatenateFrameNameMode.Label && (
          <InlineField label="Label" labelWidth={16} grow>
            <Input width={36} value={options.frameNameLabel ?? ''} placeholder="frame" onChange={this.onLabelChanged} />
          </InlineField>
        )}
      </div>
    );
  }
}

export const concatenateTransformRegistryItem: TransformerRegistryItem<ConcatenateTransformerOptions> = {
  id: DataTransformerID.concatenate,
  editor: ConcatenateTransformerEditor,
  transformation: standardTransformers.concatenateTransformer,
  name: standardTransformers.concatenateTransformer.name,
  description:
    'Combine all fields into a single frame.  Values will be appended with undefined values if not the same length.',
  categories: new Set([TransformerCategory.Combine]),
  help: getTransformationContent(DataTransformerID.concatenate).helperDocs,
};
