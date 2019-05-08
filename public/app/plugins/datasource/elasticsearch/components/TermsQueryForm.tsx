import React, { PureComponent, ChangeEvent } from 'react';
import { SelectOptionItem, FormLabel, Input } from '@grafana/ui';
import { Variable } from 'app/types/templates';
import { MetricSelect } from 'app/core/components/Select/MetricSelect';
import { GroupedSelectOptionItem } from '@grafana/ui/src/components/Select/Select';

export interface TermsQueryFormProps {
  query: any;
  fields: Array<SelectOptionItem<string>>;
  variables?: Variable[];
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

  onFieldChange = (field: string) => {
    this.setState(
      {
        field,
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
    const { variables, fields } = this.props;
    const { field, query = '', size } = this.state;
    const groupedFields: GroupedSelectOptionItem<string> = {
      label: 'Fields',
      expanded: fields.some(o => o.value === field),
      options: fields,
    };
    return (
      <>
        <div className="form-field">
          <FormLabel>Field</FormLabel>
          <MetricSelect
            variables={variables}
            placeholder="Select field"
            options={[groupedFields]}
            value={field}
            onChange={this.onFieldChange}
            className="width-15"
          />
        </div>
        <div className="form-field">
          <FormLabel>Query</FormLabel>
          <Input placeholder="lucene query" onBlur={this.onQueryBlur} onChange={this.onQueryChange} value={query} />
        </div>
        <div className="form-field">
          <FormLabel>Size</FormLabel>
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
