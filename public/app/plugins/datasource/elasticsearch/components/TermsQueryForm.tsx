import React, { PureComponent, ChangeEvent } from 'react';
import { Select, SelectOptionItem, FormLabel, Input } from '@grafana/ui';

export interface TermsQueryFormProps {
  query: any;
  fields: SelectOptionItem[];
  onChange: (query: any, definition: string) => void;
}

export interface TermsQueryFormState {
  field: string;
  query: string;
  size: string;
}

const defaultState: TermsQueryFormState = {
  field: '',
  query: '',
  size: '',
};

export class TermsQueryForm extends PureComponent<TermsQueryFormProps, TermsQueryFormState> {
  constructor(props: TermsQueryFormProps) {
    super(props);
    this.state = {
      ...defaultState,
      ...props.query,
      size: props.query.size ? props.query.size.toString() : '',
    };
  }

  triggerChange() {
    const { onChange } = this.props;
    const { field, query, size } = this.state;
    const termsQuery: any = {
      find: 'terms',
      field,
    };

    if (defaultState.field === field) {
      return;
    }

    if (defaultState.query !== query) {
      termsQuery.query = query;
    }

    if (defaultState.size !== size) {
      termsQuery.size = Number.parseInt(size, 10);
    }

    onChange(termsQuery, `Terms(${field})`);
  }

  onFieldChange = (item: SelectOptionItem) => {
    this.setState(
      {
        field: item.value,
      },
      () => {
        this.triggerChange();
      }
    );
  };

  onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      query: event.target.value,
    });
  };

  onQueryBlur = () => {
    this.triggerChange();
  };

  onSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      size: event.target.value,
    });
  };

  onSizeBlur = () => {
    this.triggerChange();
  };

  render() {
    const { fields } = this.props;
    const { field, query = '', size } = this.state;
    return (
      <>
        <div className="form-field">
          <FormLabel className="query-keyword">Field</FormLabel>
          <Select
            placeholder="Choose field"
            options={fields}
            value={fields.find(o => o.value === field)}
            onChange={this.onFieldChange}
            width={11}
          />
        </div>
        <div className="form-field">
          <FormLabel className="query-keyword">Query</FormLabel>
          <Input placeholder="lucene query" onBlur={this.onQueryBlur} onChange={this.onQueryChange} value={query} />
        </div>
        <div className="form-field">
          <FormLabel className="query-keyword">Size</FormLabel>
          <Input
            className="gf-form-input width-6"
            placeholder="500"
            onBlur={this.onSizeBlur}
            onChange={this.onSizeChange}
            type="number"
            value={size}
          />
        </div>
      </>
    );
  }
}
