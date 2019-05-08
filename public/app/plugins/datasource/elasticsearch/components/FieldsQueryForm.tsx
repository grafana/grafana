import React, { PureComponent } from 'react';
import { FormLabel } from '@grafana/ui';
import { FieldTypes } from '../types';
import { MetricSelect } from 'app/core/components/Select/MetricSelect';
import { Variable } from 'app/types/templates';
import { GroupedSelectOptionItem } from '@grafana/ui/src/components/Select/Select';

export interface FieldsQueryFormProps {
  query: any;
  variables?: Variable[];
  onChange: (query: any, definition: string) => void;
}

export interface FieldsQueryFormState {
  type: string;
}

const defaultState: FieldsQueryFormState = {
  type: '',
};

const fieldTypes: GroupedSelectOptionItem<FieldTypes> = {
  label: 'Field types',
  options: [
    { value: FieldTypes.Any, label: 'Any' },
    { value: FieldTypes.Number, label: 'Number' },
    { value: FieldTypes.Date, label: 'Date' },
    { value: FieldTypes.String, label: 'String' },
    { value: FieldTypes.Keyword, label: 'Keyword' },
    { value: FieldTypes.Nested, label: 'Nested' },
  ],
};

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
    const selectedtype = fieldTypes.options.find(o => o.value === type);

    if (defaultState.type !== type) {
      query.type = type;
    }

    onChange(query, `Fields(${selectedtype ? selectedtype.label : type})`);
  }

  onFieldTypeChange = (type: string) => {
    this.setState(
      {
        type,
      },
      () => this.triggerChange()
    );
  };

  render() {
    const { variables } = this.props;
    const { type } = this.state;
    fieldTypes.expanded = fieldTypes.options.some(o => o.value === type);

    return (
      <>
        <div className="form-field">
          <FormLabel>Field Type</FormLabel>
          <MetricSelect
            placeholder="Select field type"
            isSearchable={true}
            options={[fieldTypes]}
            value={type}
            onChange={this.onFieldTypeChange}
            variables={variables}
            className="width-15"
          />
        </div>
      </>
    );
  }
}
