import React, { ChangeEvent } from 'react';

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
import { Input, Select } from '@grafana/ui';

interface ConcatenateTransformerEditorProps extends TransformerUIProps<ConcatenateTransformerOptions> {}

const nameModes: Array<SelectableValue<ConcatenateFrameNameMode>> = [
  { value: ConcatenateFrameNameMode.FieldName, label: 'Copy frame name to field name' },
  { value: ConcatenateFrameNameMode.Label, label: 'Add a label with the frame name' },
  { value: ConcatenateFrameNameMode.Drop, label: 'Ignore the frame name' },
];

export class ConcatenateTransformerEditor extends React.PureComponent<ConcatenateTransformerEditorProps> {
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
        <div className="gf-form-inline">
          <div className="gf-form">
            <div className="gf-form-label width-8">Name</div>
            <Select
              className="width-18"
              options={nameModes}
              value={nameModes.find((v) => v.value === frameNameMode)}
              onChange={this.onModeChanged}
            />
          </div>
        </div>
        {frameNameMode === ConcatenateFrameNameMode.Label && (
          <div className="gf-form-inline">
            <div className="gf-form">
              <div className="gf-form-label width-8">Label</div>
              <Input
                className="width-18"
                value={options.frameNameLabel ?? ''}
                placeholder="frame"
                onChange={this.onLabelChanged}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
}

export const concatenateTransformRegistryItem: TransformerRegistryItem<ConcatenateTransformerOptions> = {
  id: DataTransformerID.concatenate,
  editor: ConcatenateTransformerEditor,
  transformation: standardTransformers.concatenateTransformer,
  name: 'Concatenate fields',
  description:
    'Combine all fields into a single frame.  Values will be appended with undefined values if not the same length.',
  categories: new Set([TransformerCategory.Combine]),
};
