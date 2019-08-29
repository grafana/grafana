import React from 'react';
import { FilterFieldsByNameTransformerOptions, DataTransformerID } from '@grafana/data';
import { TransformerUIProps, TransformerUIRegistyItem } from './types';
import { FormField } from '../FormField/FormField';

interface FilterByNameTransformerEditorProps extends TransformerUIProps<FilterFieldsByNameTransformerOptions> {}
interface FilterByNameTransformerEditorState {
  include: string;
}

export class FilterByNameTransformerEditor extends React.PureComponent<
  FilterByNameTransformerEditorProps,
  FilterByNameTransformerEditorState
> {
  constructor(props: FilterByNameTransformerEditorProps) {
    super(props);
    this.state = {
      include: props.options.include || '',
    };
  }

  private buildRegexp = () => {
    return this.state.include
      .split(',')
      .map(t => t.trim())
      .join('|');
  };

  onChange = (e: any) => {
    this.setState({ include: e.target.value });
  };
  onBlur = (e: any) => {
    this.props.onChange({
      ...this.props.options,
      include: this.buildRegexp(),
    });
  };

  render() {
    const { include } = this.state;
    return (
      <>
        <FormField label="Include" value={include} onChange={this.onChange} onBlur={this.onBlur} />
      </>
    );
  }
}

export const filterFieldsByNameTransformRegistryItem: TransformerUIRegistyItem = {
  id: DataTransformerID.filterFieldsByName,
  component: FilterByNameTransformerEditor,
  name: 'FilterByNameTransformerEditor',
  description: 'UI for filter by name transformation',
};
