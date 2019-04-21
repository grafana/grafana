import React, { PureComponent } from 'react';
import { Select, SelectOptionItem, FormLabel } from '@grafana/ui';
import { FieldTypes } from '../types';

export interface FieldsQueryFormProps {
  query: any;
  onChange: (query: any, definition: string) => void;
}

export interface FieldsQueryFormState {
  type: string;
}

const defaultState: FieldsQueryFormState = {
  type: '',
};

const fieldTypes: SelectOptionItem[] = [
  { value: FieldTypes.Any, label: 'Any' },
  { value: FieldTypes.Number, label: 'Number' },
  { value: FieldTypes.Date, label: 'Date' },
  { value: FieldTypes.String, label: 'String' },
  { value: FieldTypes.Keyword, label: 'Keyword' },
  { value: FieldTypes.Nested, label: 'Nested' },
];

export class FieldsQueryForm extends PureComponent<FieldsQueryFormProps, FieldsQueryFormState> {
  constructor(props: FieldsQueryFormProps) {
    super(props);
    this.state = {
      ...defaultState,
      ...props.query,
    };
  }

  componentDidMount() {
    if (!this.props.query.type) {
      this.triggerChange();
    }
  }

  triggerChange() {
    const { onChange } = this.props;
    const { type } = this.state;
    const query: any = {
      find: 'fields',
    };
    const selectedtype = fieldTypes.find(o => o.value === type);

    if (defaultState.type !== type) {
      query.type = type;
    }

    onChange(query, `Fields(${selectedtype.label})`);
  }

  onFieldTypeChange = (item: SelectOptionItem) => {
    this.setState(
      {
        type: item.value,
      },
      () => this.triggerChange()
    );
  };

  render() {
    const { type } = this.state;
    return (
      <>
        <div className="form-field">
          <FormLabel className="query-keyword">Field Type</FormLabel>
          <Select
            placeholder="Choose field type"
            isSearchable={false}
            options={fieldTypes}
            value={fieldTypes.find(o => o.value === type)}
            onChange={this.onFieldTypeChange}
            width={11}
          />
        </div>
      </>
    );
  }
}
